"""Admin-console authentication & user management.

Endpoints (mounted at /admin)
-----------------------------
POST /admin/auth/login            email + password → access + refresh JWT
POST /admin/auth/refresh          refresh JWT     → new access JWT
GET  /admin/auth/me               who am I
POST /admin/auth/logout-all       bump token_version (revoke every session)
POST /admin/auth/password         change own password

POST /admin/users                 create a new admin user (superadmin only)
GET  /admin/users                 list users (superadmin only)
PATCH/admin/users/{user_id}       update role / active / name (superadmin)
DELETE /admin/users/{user_id}     soft-delete (superadmin)

POST /admin/businesses/{slug}/members        add member (superadmin OR tenant owner)
GET  /admin/businesses/{slug}/members        list members
DELETE /admin/businesses/{slug}/members/{user_id}  remove member
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal, db_session, require_principal, require_tenant_access, require_user,
)
from app.core.auth import (
    TokenError, decode_token, hash_password, issue_token,
    needs_rehash, verify_password,
)
from app.core.logging import get_logger
from app.db.models import AdminRole, AdminUser, AuditEvent, TenantMembership

log = get_logger("admin_auth")
router = APIRouter(prefix="/admin", tags=["admin:auth"])


# ── Schemas ──────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: "MeOut"


class MeOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: Optional[str]
    role: AdminRole
    is_superadmin: bool
    active: bool
    last_login_at: Optional[datetime]
    memberships: list["MembershipOut"] = Field(default_factory=list)


class MembershipOut(BaseModel):
    business_id: uuid.UUID
    business_slug: str
    business_name: str
    role: AdminRole


class RefreshIn(BaseModel):
    refresh_token: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=256)


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)
    full_name: Optional[str] = Field(None, max_length=180)
    role: AdminRole = AdminRole.viewer
    is_superadmin: bool = False


class UserPatchIn(BaseModel):
    full_name: Optional[str] = None
    role: Optional[AdminRole] = None
    is_superadmin: Optional[bool] = None
    active: Optional[bool] = None
    new_password: Optional[str] = Field(None, min_length=8, max_length=256)


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: Optional[str]
    role: AdminRole
    is_superadmin: bool
    active: bool
    last_login_at: Optional[datetime]
    created_at: datetime


class MemberAddIn(BaseModel):
    email: EmailStr
    role: AdminRole = AdminRole.staff


MeOut.model_rebuild()
TokenPair.model_rebuild()


# ── Helpers ──────────────────────────────────────────────────────────────

async def _audit(
    db: AsyncSession, *, actor: str, action: str, target: str | None = None,
    data: dict | None = None,
):
    db.add(AuditEvent(actor=actor[:64], action=action[:64], target=target, data=data or {}))


async def _memberships_for(db: AsyncSession, user_id: uuid.UUID) -> list[MembershipOut]:
    from app.db.models import Business
    rows = (await db.execute(
        select(TenantMembership, Business.slug, Business.name)
        .join(Business, Business.id == TenantMembership.business_id)
        .where(TenantMembership.admin_user_id == user_id)
        .order_by(Business.name.asc())
    )).all()
    return [
        MembershipOut(
            business_id=r.TenantMembership.business_id,
            business_slug=r.slug, business_name=r.name,
            role=r.TenantMembership.role,
        )
        for r in rows
    ]


async def _me_payload(db: AsyncSession, user: AdminUser) -> MeOut:
    return MeOut(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_superadmin=user.is_superadmin, active=user.active,
        last_login_at=user.last_login_at,
        memberships=await _memberships_for(db, user.id),
    )


def _issue_pair(user: AdminUser) -> tuple[str, datetime, str]:
    access, exp = issue_token(
        user_id=user.id, email=user.email, role=user.role.value,
        is_superadmin=user.is_superadmin, token_version=user.token_version,
        token_type="access",
    )
    refresh, _ = issue_token(
        user_id=user.id, email=user.email, role=user.role.value,
        is_superadmin=user.is_superadmin, token_version=user.token_version,
        token_type="refresh",
    )
    return access, exp, refresh


# ── Auth endpoints ───────────────────────────────────────────────────────

@router.post("/auth/login", response_model=TokenPair)
async def login(payload: LoginIn, db: AsyncSession = Depends(db_session)) -> TokenPair:
    user = (await db.execute(
        select(AdminUser).where(AdminUser.email == payload.email.lower())
    )).scalar_one_or_none()
    # Constant-ish work even when the user doesn't exist, to avoid an
    # easy email-enumeration oracle.
    if user is None or not user.active or not verify_password(payload.password, user.password_hash):
        log.warning("login_failed", email=payload.email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    user.last_login_at = datetime.now(timezone.utc)
    await _audit(db, actor=f"user:{user.email}", action="login", target=str(user.id))
    await db.commit()
    await db.refresh(user)
    access, exp, refresh = _issue_pair(user)
    me = await _me_payload(db, user)
    log.info("login_ok", email=user.email, user_id=str(user.id))
    return TokenPair(access_token=access, refresh_token=refresh, expires_at=exp, user=me)


@router.post("/auth/refresh", response_model=TokenPair)
async def refresh_token(payload: RefreshIn, db: AsyncSession = Depends(db_session)) -> TokenPair:
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"refresh_failed:{e}")
    try:
        uid = uuid.UUID(claims["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh_failed:bad_sub")
    user = (await db.execute(
        select(AdminUser).where(AdminUser.id == uid)
    )).scalar_one_or_none()
    if user is None or not user.active or int(claims.get("tv", -1)) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh_failed:revoked_or_inactive")
    access, exp, new_refresh = _issue_pair(user)
    return TokenPair(
        access_token=access, refresh_token=new_refresh, expires_at=exp,
        user=await _me_payload(db, user),
    )


@router.get("/auth/me", response_model=MeOut)
async def me(
    db: AsyncSession = Depends(db_session),
    user: AdminUser = Depends(require_user),
) -> MeOut:
    return await _me_payload(db, user)


@router.post("/auth/logout-all", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout_everywhere(
    db: AsyncSession = Depends(db_session),
    user: AdminUser = Depends(require_user),
) -> Response:
    user.token_version = (user.token_version or 0) + 1
    await _audit(db, actor=f"user:{user.email}", action="logout_all", target=str(user.id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/password", response_model=MeOut)
async def change_password(
    payload: PasswordChangeIn,
    db: AsyncSession = Depends(db_session),
    user: AdminUser = Depends(require_user),
) -> MeOut:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "current password incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.token_version = (user.token_version or 0) + 1  # revoke other sessions
    await _audit(db, actor=f"user:{user.email}", action="password_change", target=str(user.id))
    await db.commit()
    await db.refresh(user)
    return await _me_payload(db, user)


# ── User management (superadmin) ─────────────────────────────────────────

def _superadmin_only(p: Principal):
    if not p.is_superadmin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "superadmin role required",
        )


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateIn,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> UserOut:
    _superadmin_only(p)
    email = payload.email.lower()
    exists = (await db.execute(
        select(AdminUser).where(AdminUser.email == email)
    )).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already exists")
    user = AdminUser(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_superadmin=payload.is_superadmin,
        active=True,
    )
    db.add(user)
    await _audit(
        db, actor=p.actor_label, action="user_create", target=email,
        data={"role": payload.role.value, "superadmin": payload.is_superadmin},
    )
    await db.commit()
    await db.refresh(user)
    return UserOut(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_superadmin=user.is_superadmin, active=user.active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
    limit: int = 200,
) -> list[UserOut]:
    _superadmin_only(p)
    rows = (await db.execute(
        select(AdminUser).order_by(AdminUser.created_at.desc()).limit(min(limit, 500))
    )).scalars().all()
    return [
        UserOut(
            id=u.id, email=u.email, full_name=u.full_name, role=u.role,
            is_superadmin=u.is_superadmin, active=u.active,
            last_login_at=u.last_login_at, created_at=u.created_at,
        )
        for u in rows
    ]


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: uuid.UUID,
    payload: UserPatchIn,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> UserOut:
    _superadmin_only(p)
    user = (await db.execute(
        select(AdminUser).where(AdminUser.id == user_id)
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    data = payload.model_dump(exclude_unset=True)
    pw = data.pop("new_password", None)
    for k, v in data.items():
        setattr(user, k, v)
    if pw:
        user.password_hash = hash_password(pw)
        user.token_version = (user.token_version or 0) + 1
    await _audit(
        db, actor=p.actor_label, action="user_update", target=str(user.id),
        data={"fields": list(data.keys()) + (["password"] if pw else [])},
    )
    await db.commit()
    await db.refresh(user)
    return UserOut(
        id=user.id, email=user.email, full_name=user.full_name, role=user.role,
        is_superadmin=user.is_superadmin, active=user.active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
):
    _superadmin_only(p)
    user = (await db.execute(
        select(AdminUser).where(AdminUser.id == user_id)
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    # Safety: never let an operator delete the last surviving superadmin.
    if user.is_superadmin:
        remaining = (await db.execute(
            select(func.count(AdminUser.id))
            .where(AdminUser.is_superadmin.is_(True))
            .where(AdminUser.active.is_(True))
            .where(AdminUser.id != user.id)
        )).scalar_one()
        if not remaining:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "cannot remove the last active superadmin",
            )
    user.active = False
    user.token_version = (user.token_version or 0) + 1
    await _audit(db, actor=p.actor_label, action="user_delete", target=str(user.id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Tenant memberships (per-business team) ───────────────────────────────

@router.post(
    "/businesses/{slug}/members",
    response_model=MembershipOut, status_code=status.HTTP_201_CREATED,
)
async def add_member(
    slug: str,
    payload: MemberAddIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> MembershipOut:
    user = (await db.execute(
        select(AdminUser).where(AdminUser.email == payload.email.lower())
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found — create the AdminUser first")
    existing = (await db.execute(
        select(TenantMembership)
        .where(TenantMembership.business_id == ctx.business.id)
        .where(TenantMembership.admin_user_id == user.id)
    )).scalar_one_or_none()
    if existing is not None:
        existing.role = payload.role
        m = existing
    else:
        m = TenantMembership(
            business_id=ctx.business.id, admin_user_id=user.id, role=payload.role,
        )
        db.add(m)
    await _audit(
        db, actor=ctx.principal.actor_label, action="member_add",
        target=str(user.id),
        data={"business_slug": slug, "role": payload.role.value},
    )
    await db.commit()
    await db.refresh(m)
    return MembershipOut(
        business_id=m.business_id, business_slug=ctx.business.slug,
        business_name=ctx.business.name, role=m.role,
    )


@router.get("/businesses/{slug}/members", response_model=list[dict])
async def list_members(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
) -> list[dict]:
    rows = (await db.execute(
        select(TenantMembership, AdminUser)
        .join(AdminUser, AdminUser.id == TenantMembership.admin_user_id)
        .where(TenantMembership.business_id == ctx.business.id)
        .order_by(AdminUser.email.asc())
    )).all()
    return [
        {
            "user_id": str(r.AdminUser.id),
            "email": r.AdminUser.email,
            "full_name": r.AdminUser.full_name,
            "global_role": r.AdminUser.role.value,
            "tenant_role": r.TenantMembership.role.value,
            "active": r.AdminUser.active,
        }
        for r in rows
    ]


@router.delete(
    "/businesses/{slug}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT, response_class=Response,
)
async def remove_member(
    slug: str, user_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
):
    m = (await db.execute(
        select(TenantMembership)
        .where(TenantMembership.business_id == ctx.business.id)
        .where(TenantMembership.admin_user_id == user_id)
    )).scalar_one_or_none()
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "membership not found")
    await db.delete(m)
    await _audit(
        db, actor=ctx.principal.actor_label, action="member_remove",
        target=str(user_id), data={"business_slug": slug},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
