"""scope orders directly by business

Revision ID: 0008_orders_business_id
Revises: 0007_customer_safety
Create Date: 2026-05-21

Orders are created from a tenant-scoped conversation, but payment callbacks
need tenant context even when the conversation row is not eagerly loaded.
This column also prevents checkout IDs from being attached across tenants for
customers who interact with multiple businesses.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_orders_business_id"
down_revision = "0007_customer_safety"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE orders o
        SET business_id = c.business_id
        FROM conversations c
        WHERE o.conversation_id = c.id
          AND o.business_id IS NULL
        """
    )
    op.create_foreign_key(
        "fk_orders_business_id",
        "orders",
        "businesses",
        ["business_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_orders_business_id", "orders", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_business_id", table_name="orders")
    op.drop_constraint("fk_orders_business_id", "orders", type_="foreignkey")
    op.drop_column("orders", "business_id")
