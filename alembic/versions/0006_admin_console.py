"""admin console: users, memberships, broadcasts, webhooks, takeover columns

Revision ID: 0006_admin_console
Revises: 0005_business_geo
Create Date: 2026-05-18

Phase 8 — "ultimate admin" backbone:

- `admin_users`        — local password+JWT identities for the console
- `tenant_memberships` — N:M between admin users and businesses, with
                         a per-tenant role override
- `broadcasts`         — outbound campaigns (WA template blasts etc.)
- `webhook_endpoints`  — per-tenant outbound webhook destinations
- `conversations.ai_paused`     — staff takeover flag (AI is skipped while True)
- `conversations.taken_over_by` — admin user currently handling the convo

Also: adds an index on `audit_events.created_at` so the new admin audit
viewer can do efficient range-scan pagination over millions of rows.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006_admin_console"
down_revision = "0005_business_geo"
branch_labels = None
depends_on = None


admin_role_enum = sa.Enum(
    "superadmin", "owner", "staff", "viewer",
    name="admin_role_enum",
)
broadcast_status_enum = sa.Enum(
    "draft", "sending", "done", "failed", "cancelled",
    name="broadcast_status_enum",
)
# Non-creating references for use inside CREATE TABLE — the actual types
# are created once via the .create(bind, checkfirst=True) calls in upgrade().
admin_role_col = postgresql.ENUM(name="admin_role_enum", create_type=False)
broadcast_status_col = postgresql.ENUM(name="broadcast_status_enum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    admin_role_enum.create(bind, checkfirst=True)
    broadcast_status_enum.create(bind, checkfirst=True)

    # ── admin_users ───────────────────────────────────────────────────
    op.create_table(
        "admin_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(180), nullable=False, unique=True),
        sa.Column("full_name", sa.String(180), nullable=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column(
            "role", admin_role_col,
            nullable=False, server_default="viewer",
        ),
        sa.Column("is_superadmin", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("token_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_admin_users_email", "admin_users", ["email"], unique=True)
    op.create_index("ix_admin_users_role", "admin_users", ["role"])

    # ── tenant_memberships ────────────────────────────────────────────
    op.create_table(
        "tenant_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "admin_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "role", admin_role_col,
            nullable=False, server_default="staff",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("business_id", "admin_user_id", name="uq_membership_biz_user"),
    )
    op.create_index("ix_memberships_business", "tenant_memberships", ["business_id"])
    op.create_index("ix_memberships_user", "tenant_memberships", ["admin_user_id"])

    # ── broadcasts ────────────────────────────────────────────────────
    op.create_table(
        "broadcasts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "created_by", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("name", sa.String(180), nullable=False),
        # Reuses the existing channel_enum from 0001_init — do NOT recreate.
        sa.Column(
            "channel", postgresql.ENUM(name="channel_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("template_name", sa.String(120), nullable=True),
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("segment", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "status", broadcast_status_col,
            nullable=False, server_default="draft",
        ),
        sa.Column("recipients_total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_broadcasts_business", "broadcasts", ["business_id"])
    op.create_index("ix_broadcasts_status", "broadcasts", ["status"])

    # ── webhook_endpoints ─────────────────────────────────────────────
    op.create_table(
        "webhook_endpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("url", sa.String(512), nullable=False),
        sa.Column("secret", sa.String(128), nullable=False),
        sa.Column("events", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("last_status", sa.Integer, nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_webhooks_business", "webhook_endpoints", ["business_id"])

    # ── conversations.ai_paused + taken_over_by ───────────────────────
    op.add_column(
        "conversations",
        sa.Column("ai_paused", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "conversations",
        sa.Column("taken_over_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_conversations_taken_over_by", "conversations", ["taken_over_by"],
    )

    # ── audit_events.created_at index (range scans for audit viewer) ──
    op.create_index(
        "ix_audit_events_created_at", "audit_events", ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_index("ix_conversations_taken_over_by", table_name="conversations")
    op.drop_column("conversations", "taken_over_by")
    op.drop_column("conversations", "ai_paused")

    op.drop_index("ix_webhooks_business", table_name="webhook_endpoints")
    op.drop_table("webhook_endpoints")

    op.drop_index("ix_broadcasts_status", table_name="broadcasts")
    op.drop_index("ix_broadcasts_business", table_name="broadcasts")
    op.drop_table("broadcasts")

    op.drop_index("ix_memberships_user", table_name="tenant_memberships")
    op.drop_index("ix_memberships_business", table_name="tenant_memberships")
    op.drop_table("tenant_memberships")

    op.drop_index("ix_admin_users_role", table_name="admin_users")
    op.drop_index("ix_admin_users_email", table_name="admin_users")
    op.drop_table("admin_users")

    broadcast_status_enum.drop(op.get_bind(), checkfirst=True)
    admin_role_enum.drop(op.get_bind(), checkfirst=True)
