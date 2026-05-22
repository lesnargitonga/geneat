"""add latitude/longitude to businesses

Revision ID: 0005_business_geo
Revises: 0004_conversations_business_id
Create Date: 2026-05-18

Stores the merchant's pinned location so the agent can send a WhatsApp
map pin via the `send_location_pin` tool.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_business_geo"
down_revision = "0004_conversations_business_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("businesses", "longitude")
    op.drop_column("businesses", "latitude")
