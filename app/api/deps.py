"""FastAPI dependencies."""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import TokenError, decode_token
from app.core.config import get_settings
from app.db.models import AdminRole, AdminUser, Business, TenantMembership
from app.db.session import SessionLocal


async def db_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as s:
        try:
            yield s
        except Exception:
            await s.rollback()
            raise


# ── Admin-console auth ───────────────────────────────────────────────────
#
# Two acceptable bearer credentials:
#   1. A JWT minted by /admin/auth/login (preferred — per-user, auditable).
#   2. The legacy `ADMIN_API_TOKEN` (machine token; mapped to a virtual
#      superadmin so existing scripts keep working).
#
# Endpoints that only need *some* admin auth use `require_principal`.
# Endpoints that need a real user (e.g. takeover, audit by actor) use
# `require_user` which 403s the machine token.

@dataclass
class Principal:
    """The authenticated caller for an /admin/* request."""
    user: Optional[AdminUser]      # None when authenticated via legacy token
    is_machine: bool               # True for the legacy ADMIN_API_TOKEN path
    role: AdminRole                # Effective role (superadmin for machine)
    is_superadmin: bool

    @property
    def actor_label(self) -> str:
        if self.is_machine:
            return "machine:admin_api_token"
        return f"user:{self.user.email}" if self.user else "unknown"


async def _principal_from_token(
    raw: str, db: AsyncSession,
) -> Principal:
    settings = get_settings()
    legacy = settings.admin_api_token.get_secret_value()
    if legacy and raw == legacy:
        return Principal(
            user=None, is_machine=True,
            role=AdminRole.superadmin, is_superadmin=True,
        )
    try:
        payload = decode_token(raw, expected_type="access")
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"auth_failed:{e}")
    try:
        uid = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "auth_failed:bad_sub")
    user = (await db.execute(
        select(AdminUser).where(AdminUser.id == uid)
    )).scalar_one_or_none()
    if user is None or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "auth_failed:user_inactive")
    if int(payload.get("tv", -1)) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "auth_failed:token_revoked")
    return Principal(
        user=user, is_machine=False,
        role=user.role, is_superadmin=user.is_superadmin,
    )


async def require_principal(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(db_session),
) -> Principal:
    """Any valid admin credential — JWT or legacy machine token."""
    settings = get_settings()
    legacy = settings.admin_api_token.get_secret_value()
    if not authorization or not authorization.startswith("Bearer "):
        # If neither auth method is configured, surface a 503 so an
        # operator immediately knows the console is disabled, not just
        # that they forgot a header.
        if not legacy:
            # Check whether *any* admin users exist; if not the operator
            # needs to seed one before they can authenticate.
            from sqlalchemy import func as _f
            n = (await db.execute(select(_f.count(AdminUser.id)))).scalar_one()
            if not n:
                raise HTTPException(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "Admin console not initialised — seed an AdminUser or set ADMIN_API_TOKEN.",
                )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    return await _principal_from_token(token, db)


async def require_user(
    p: Principal = Depends(require_principal),
) -> AdminUser:
    """Require a real human user (machine token is rejected)."""
    if p.is_machine or p.user is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "this endpoint requires a user JWT, not the legacy machine token",
        )
    return p.user


def require_role(*allowed: AdminRole):
    """Dependency factory: require the principal's *global* role to be in
    `allowed` (superadmins always pass)."""
    allowed_set = set(allowed)

    async def _dep(p: Principal = Depends(require_principal)) -> Principal:
        if p.is_superadmin:
            return p
        if p.role not in allowed_set:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"role '{p.role.value}' lacks permission; need one of "
                f"{[r.value for r in allowed_set]}",
            )
        return p

    return _dep


# Common role bundles for readability at call sites.
require_owner = require_role(AdminRole.owner)
require_staff_or_owner = require_role(AdminRole.staff, AdminRole.owner)
require_any_admin = require_role(AdminRole.viewer, AdminRole.staff, AdminRole.owner)


async def resolve_business_or_404(db: AsyncSession, slug: str) -> Business:
    b = (await db.execute(
        select(Business).where(Business.slug == slug)
    )).scalar_one_or_none()
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Business '{slug}' not found")
    return b


async def tenant_membership_role(
    db: AsyncSession, *, user: AdminUser, business_id: uuid.UUID,
) -> AdminRole | None:
    """Return the user's per-tenant role (None if not a member)."""
    res = await db.execute(
        select(TenantMembership.role)
        .where(TenantMembership.admin_user_id == user.id)
        .where(TenantMembership.business_id == business_id)
    )
    return res.scalar_one_or_none()


def require_tenant_access(min_role: AdminRole = AdminRole.viewer):
    """Dependency factory: require the principal can act on the tenant in
    the URL's `{slug}` path param, at or above `min_role`.

    Rules:
      * Superadmins and the legacy machine token always pass.
      * Otherwise the user must have a TenantMembership on this business
        whose role meets `min_role`.

    The effective `Business` and `Principal` are returned together so the
    handler doesn't have to re-fetch.
    """
    _rank = {
        AdminRole.viewer: 0,
        AdminRole.staff: 1,
        AdminRole.owner: 2,
        AdminRole.superadmin: 3,
    }

    @dataclass
    class TenantContext:
        principal: Principal
        business: Business
        effective_role: AdminRole

    async def _dep(
        slug: str,
        p: Principal = Depends(require_principal),
        db: AsyncSession = Depends(db_session),
    ) -> TenantContext:
        b = await resolve_business_or_404(db, slug)
        if p.is_superadmin or p.is_machine:
            return TenantContext(principal=p, business=b, effective_role=AdminRole.superadmin)
        assert p.user is not None
        m_role = await tenant_membership_role(db, user=p.user, business_id=b.id)
        if m_role is None:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"user has no membership in tenant '{slug}'",
            )
        if _rank[m_role] < _rank[min_role]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"tenant role '{m_role.value}' below required '{min_role.value}'",
            )
        return TenantContext(principal=p, business=b, effective_role=m_role)

    return _dep

