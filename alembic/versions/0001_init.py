"""initial schema

Revision ID: 0001_init
Revises:
Create Date: 2026-05-17
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None

EMBED_DIM = 1536


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    channel = postgresql.ENUM("whatsapp", "voice", "sms", "mock", name="channel_enum", create_type=False)
    conv_status = postgresql.ENUM("active", "resolved", "human_escalated", "abandoned", name="conv_status_enum", create_type=False)
    sender = postgresql.ENUM("user", "ai", "system", "agent", name="sender_enum", create_type=False)
    pay_status = postgresql.ENUM("pending", "paid", "failed", "cancelled", "timeout", name="payment_status_enum", create_type=False)
    for e in (channel, conv_status, sender, pay_status):
        e.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone_number", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(120)),
        sa.Column("preferred_language", sa.String(8)),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_customers_phone_number", "customers", ["phone_number"])

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", channel, nullable=False),
        sa.Column("status", conv_status, nullable=False, server_default="active"),
        sa.Column("failed_turns", sa.Integer, server_default="0"),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_conversations_customer_id", "conversations", ["customer_id"])
    op.create_index("ix_conversations_status", "conversations", ["status"])

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender", sender, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("language", sa.String(8)),
        sa.Column("media_url", sa.Text),
        sa.Column("provider_message_id", sa.String(128)),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("provider_message_id", name="uq_messages_provider_id"),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_provider_message_id", "messages", ["provider_message_id"])

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="SET NULL")),
        sa.Column("details", postgresql.JSONB, server_default="{}"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="KES"),
        sa.Column("mpesa_checkout_id", sa.String(64)),
        sa.Column("mpesa_receipt", sa.String(64)),
        sa.Column("payment_status", pay_status, nullable=False, server_default="pending"),
        sa.Column("appointment_time", sa.DateTime(timezone=True)),
        sa.Column("calendar_event_id", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_orders_customer_id", "orders", ["customer_id"])
    op.create_index("ix_orders_payment_status", "orders", ["payment_status"])
    op.create_index("ix_orders_mpesa_checkout_id", "orders", ["mpesa_checkout_id"])

    op.create_table(
        "knowledge_base",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True)),
        sa.Column("source", sa.String(256)),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("embedding", Vector(EMBED_DIM), nullable=False),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_knowledge_business_id", "knowledge_base", ["business_id"])
    op.execute(
        "CREATE INDEX ix_knowledge_embedding_hnsw ON knowledge_base "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    op.create_table(
        "tool_invocations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="SET NULL")),
        sa.Column("tool_name", sa.String(64), nullable=False),
        sa.Column("arguments", postgresql.JSONB, server_default="{}"),
        sa.Column("result", postgresql.JSONB),
        sa.Column("success", sa.Boolean, server_default=sa.true()),
        sa.Column("latency_ms", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tool_invocations_conversation_id", "tool_invocations", ["conversation_id"])
    op.create_index("ix_tool_invocations_tool_name", "tool_invocations", ["tool_name"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("actor", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target", sa.String(128)),
        sa.Column("data", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_events_action", "audit_events", ["action"])


def downgrade() -> None:
    for t in ("audit_events", "tool_invocations", "knowledge_base", "orders", "messages", "conversations", "customers"):
        op.drop_table(t)
    for e in ("payment_status_enum", "sender_enum", "conv_status_enum", "channel_enum"):
        op.execute(f"DROP TYPE IF EXISTS {e}")
