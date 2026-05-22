"""First-boot admin seeding.

Reads `admin_seed_email` / `admin_seed_password` from settings; if both
are set AND the `admin_users` table is empty, creates a superadmin so
the operator can log in to the console on a fresh deploy.

Idempotent: does nothing if any admin already exists. Designed to be
safe to leave configured in the environment forever.
"""
from __future__ import annotations

from sqlalchemy import func, select

from app.core.auth import hash_password
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import AdminRole, AdminUser
from app.db.session import SessionLocal

log = get_logger("admin_seed")


async def seed_if_needed() -> AdminUser | None:
    settings = get_settings()
    email = (settings.admin_seed_email or "").strip().lower()
    password = settings.admin_seed_password.get_secret_value().strip()
    if not email or not password:
        return None
    async with SessionLocal() as db:
        count = (await db.execute(select(func.count(AdminUser.id)))).scalar_one()
        if count:
            return None
        user = AdminUser(
            email=email,
            full_name="Seeded Superadmin",
            password_hash=hash_password(password),
            role=AdminRole.superadmin,
            is_superadmin=True,
            active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        log.info("admin_seeded", email=email, user_id=str(user.id))
        return user
