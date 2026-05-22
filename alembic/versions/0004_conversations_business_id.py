"""scope conversations by (customer_id, business_id)

Revision ID: 0004_conversations_business_id
Revises: 0003_businesses
Create Date: 2026-05-18

A single tester MSISDN can interact with multiple tenants — without this
column, all messages get glued into one conversation regardless of which
business they were meant for. With business_id, the active conversation
lookup becomes (customer_id, business_id, status=active).
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_conversations_business_id"
down_revision = "0003_businesses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_conversations_business_id",
        "conversations", "businesses",
        ["business_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_conversations_customer_business_status",
        "conversations",
        ["customer_id", "business_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_customer_business_status", table_name="conversations")
    op.drop_constraint("fk_conversations_business_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "business_id")
