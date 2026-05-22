"""CLI: create or upsert an admin user.

Usage:
    PYTHONPATH=. ./.venv/bin/python scripts/create_admin.py \
        --email me@example.com --password 's3cret-pass' \
        --name 'Ops Lead' --role superadmin

If the email already exists, you'll be prompted before any change. Use
`--force` to skip the prompt (e.g. in CI).
"""
from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.auth import hash_password
from app.db.models import AdminRole, AdminUser
from app.db.session import SessionLocal


async def main(args: argparse.Namespace) -> int:
    email = args.email.strip().lower()
    if len(args.password) < 8:
        print("ERROR: password must be at least 8 chars", file=sys.stderr)
        return 2
    try:
        role = AdminRole(args.role)
    except ValueError:
        print(f"ERROR: invalid role '{args.role}'. Choose from {[r.value for r in AdminRole]}", file=sys.stderr)
        return 2
    async with SessionLocal() as db:
        existing = (await db.execute(
            select(AdminUser).where(AdminUser.email == email)
        )).scalar_one_or_none()
        if existing is not None:
            if not args.force:
                resp = input(f"User {email} exists — overwrite password/role? [y/N] ").strip().lower()
                if resp != "y":
                    print("Aborted."); return 1
            existing.password_hash = hash_password(args.password)
            existing.full_name = args.name or existing.full_name
            existing.role = role
            existing.is_superadmin = args.superadmin or role == AdminRole.superadmin
            existing.active = True
            existing.token_version = (existing.token_version or 0) + 1
            await db.commit()
            print(f"OK: updated existing user {email} (role={role.value})")
            return 0
        user = AdminUser(
            email=email, full_name=args.name,
            password_hash=hash_password(args.password),
            role=role,
            is_superadmin=args.superadmin or role == AdminRole.superadmin,
            active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"OK: created {email} (id={user.id}, role={role.value})")
        return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Create or upsert an admin console user.")
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--name", default=None)
    p.add_argument("--role", default="superadmin",
                   help="superadmin | owner | staff | viewer")
    p.add_argument("--superadmin", action="store_true",
                   help="grant the global superadmin flag explicitly")
    p.add_argument("--force", action="store_true",
                   help="overwrite existing user without prompt")
    rc = asyncio.run(main(p.parse_args()))
    sys.exit(rc)
