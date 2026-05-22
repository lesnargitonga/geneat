"""add businesses table + link knowledge_base via FK

Revision ID: 0003_businesses
Revises: 0002_embed_768
Create Date: 2026-05-18

Multi-tenant: each pitched/onboarded SME gets a row in `businesses`.
Webhook routes incoming WhatsApp messages by `meta_wa_phone_number_id`
to the right business so the agent loads the right brand voice + KB.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_businesses"
down_revision = "0002_embed_768"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("industry", sa.String(64), nullable=False),  # salon, restaurant, clinic, retail, ...
        sa.Column("location", sa.String(256)),
        sa.Column("meta_wa_phone_number_id", sa.String(32), unique=True, index=True),
        sa.Column("contact_phone", sa.String(20)),
        sa.Column("contact_email", sa.String(128)),
        sa.Column("brand_voice", sa.Text),         # 1-paragraph persona description
        sa.Column("greeting_template", sa.Text),   # first-touch greeting (LLM may use as inspiration)
        sa.Column("language_primary", sa.String(8), server_default="en"),
        sa.Column("language_secondary", sa.String(8), server_default="sw"),
        sa.Column("profile", postgresql.JSONB, server_default="{}"),  # flexible per-business config
        sa.Column("active", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Link knowledge_base.business_id → businesses.id (was nullable UUID before).
    op.create_foreign_key(
        "fk_knowledge_business",
        source_table="knowledge_base",
        referent_table="businesses",
        local_cols=["business_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_knowledge_business", "knowledge_base", type_="foreignkey")
    op.drop_table("businesses")
