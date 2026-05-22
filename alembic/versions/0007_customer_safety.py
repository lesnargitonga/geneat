"""customer safety columns + per-msg flags

Revision ID: 0007_customer_safety
Revises: 0006_admin_console
Create Date: 2026-05-18

Phase 8.5 — "lock the front door":

- customers.blocked            (bool, default false, indexed)
- customers.blocked_reason     (text, nullable)
- customers.blocked_at         (timestamptz, nullable)
- customers.abuse_score        (int, default 0)
- customers.last_flag_at       (timestamptz, nullable)
- messages.safety_flags        (JSONB, nullable) — list of pattern tags
                                that fired for this turn (audit only)

The columns are kept narrow on purpose: the abuse engine is deterministic
and lives in app/ai/safety.py — these are just persistence + indices.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_customer_safety"
down_revision = "0006_admin_console"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("blocked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "customers",
        sa.Column("blocked_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("abuse_score", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "customers",
        sa.Column("last_flag_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_customers_blocked", "customers", ["blocked"],
        postgresql_where=sa.text("blocked = true"),
    )
    op.create_index(
        "ix_customers_abuse_score", "customers", ["abuse_score"],
        postgresql_where=sa.text("abuse_score > 0"),
    )

    op.add_column(
        "messages",
        sa.Column("safety_flags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "safety_flags")
    op.drop_index("ix_customers_abuse_score", table_name="customers")
    op.drop_index("ix_customers_blocked", table_name="customers")
    op.drop_column("customers", "last_flag_at")
    op.drop_column("customers", "abuse_score")
    op.drop_column("customers", "blocked_at")
    op.drop_column("customers", "blocked_reason")
    op.drop_column("customers", "blocked")
