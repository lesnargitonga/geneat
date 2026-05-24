"""Relational + vector models. One file, deliberately compact.

Schema fulfils the spec:
  customers, conversations, messages, orders/bookings, knowledge_base (vector),
plus operational tables: tool_invocations, payments, audit_events.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON, BigInteger, Boolean, DateTime, Enum, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

EMBED_DIM = 768  # Matches the current Alembic schema and default
                 # Ollama nomic-embed-text embedder.


# ── Enums ─────────────────────────────────────────────────────────────

class Channel(str, enum.Enum):
    whatsapp = "whatsapp"
    voice = "voice"
    sms = "sms"
    mock = "mock"


class ConvStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"
    human_escalated = "human_escalated"
    abandoned = "abandoned"


class Sender(str, enum.Enum):
    user = "user"
    ai = "ai"
    system = "system"
    agent = "agent"  # human agent


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    cancelled = "cancelled"
    timeout = "timeout"


class AdminRole(str, enum.Enum):
    """Roles inside the admin console.

    superadmin: cross-tenant god mode (manage users, businesses, billing).
    owner:      full control inside one or more tenants (via memberships).
    staff:      can take over conversations + send replies + edit KB.
    viewer:     read-only dashboard access.
    """
    superadmin = "superadmin"
    owner = "owner"
    staff = "staff"
    viewer = "viewer"


class BroadcastStatus(str, enum.Enum):
    draft = "draft"
    sending = "sending"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


# ── Models ────────────────────────────────────────────────────────────

def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Business(Base):
    """A tenant — each SME using the platform. Webhook routes by meta_wa_phone_number_id."""
    __tablename__ = "businesses"
    id: Mapped[uuid.UUID] = _pk()
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(256))
    industry: Mapped[str] = mapped_column(String(64))
    location: Mapped[str | None] = mapped_column(String(256))
    meta_wa_phone_number_id: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20))
    contact_email: Mapped[str | None] = mapped_column(String(128))
    brand_voice: Mapped[str | None] = mapped_column(Text)
    greeting_template: Mapped[str | None] = mapped_column(Text)
    language_primary: Mapped[str] = mapped_column(String(8), default="en")
    language_secondary: Mapped[str] = mapped_column(String(8), default="sw")
    profile: Mapped[dict] = mapped_column(JSONB, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[uuid.UUID] = _pk()
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(120))
    preferred_language: Mapped[str | None] = mapped_column(String(8))  # ISO-639-1
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── Safety / abuse controls (Phase 8.5) ───────────────────────────
    # blocked: admin-set or auto-set hard block. handle_inbound short-
    #          circuits with a single canned refusal — no LLM call.
    # abuse_score: sliding deterministic counter driven by app/ai/safety.
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    abuse_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_flag_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="customer")


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = _pk()
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    business_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    channel: Mapped[Channel] = mapped_column(Enum(Channel, name="channel_enum"))
    status: Mapped[ConvStatus] = mapped_column(
        Enum(ConvStatus, name="conv_status_enum"), default=ConvStatus.active, index=True,
    )
    failed_turns: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── Admin-console takeover state (Phase 8) ───────────────────────
    # ai_paused: when True, the AI graph is skipped on inbound turns even
    #            if status != human_escalated. Set by /admin takeover.
    # taken_over_by: admin_users.id of the staff member currently handling
    #                this conversation. NULL means "queue / unassigned".
    ai_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    taken_over_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True,
    )

    customer: Mapped[Customer] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = _pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    sender: Mapped[Sender] = mapped_column(Enum(Sender, name="sender_enum"))
    content: Mapped[str] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(String(8))
    media_url: Mapped[str | None] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(String(128), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Safety: list of pattern tags that fired on this message (audit only).
    # Populated for both user msgs (input filter) and ai msgs (output filter).
    safety_flags: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")

    __table_args__ = (
        UniqueConstraint("provider_message_id", name="uq_messages_provider_id"),
    )


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[uuid.UUID] = _pk()
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    business_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"))
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="KES")
    mpesa_checkout_id: Mapped[str | None] = mapped_column(String(64), index=True)
    mpesa_receipt: Mapped[str | None] = mapped_column(String(64))
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum"), default=PaymentStatus.pending, index=True,
    )
    payment_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    appointment_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calendar_event_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class KnowledgeChunk(Base):
    """A chunk of business-uploaded content (PDF, FAQ, menu) for RAG."""
    __tablename__ = "knowledge_base"
    id: Mapped[uuid.UUID] = _pk()
    business_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    source: Mapped[str | None] = mapped_column(String(256))  # filename / url
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "ix_knowledge_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class ToolInvocation(Base):
    """Audit log of every AI tool call (RAG, M-Pesa, calendar, …)."""
    __tablename__ = "tool_invocations"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"), index=True)
    tool_name: Mapped[str] = mapped_column(String(64), index=True)
    arguments: Mapped[dict] = mapped_column(JSONB, default=dict)
    result: Mapped[dict | None] = mapped_column(JSONB)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    """Generic security/compliance audit trail."""
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64), index=True)
    target: Mapped[str | None] = mapped_column(String(128))
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True,
    )


# ── Phase 8: admin console (users / memberships / broadcasts / webhooks) ─

class AdminUser(Base):
    """A human (or machine bot) authenticated to the admin console.

    Authentication is local: bcrypt-hashed password + JWT session.
    External-IdP federation (Google, Okta) can be layered later by
    treating their `sub` as the email and skipping password verification.
    """
    __tablename__ = "admin_users"
    id: Mapped[uuid.UUID] = _pk()
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(180))
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole, name="admin_role_enum"),
        default=AdminRole.viewer, index=True,
    )
    # Superadmins bypass per-tenant ACLs and see every business.
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Monotonic counter — incremented on password change / logout-everywhere.
    # All issued JWTs carry this value; mismatch → token invalid. Lets us
    # revoke sessions without keeping a server-side token blacklist.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TenantMembership(Base):
    """Many-to-many: which admin users have access to which businesses,
    with a per-tenant role override (a global `staff` user can be `owner`
    inside one specific tenant)."""
    __tablename__ = "tenant_memberships"
    id: Mapped[uuid.UUID] = _pk()
    business_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True,
    )
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("admin_users.id", ondelete="CASCADE"), index=True,
    )
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole, name="admin_role_enum", create_type=False),
        default=AdminRole.staff,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("business_id", "admin_user_id", name="uq_membership_biz_user"),
    )


class Broadcast(Base):
    """Per-tenant outbound campaign (WA template blast or free-form
    inside the 24h customer-service window). Recipients are computed at
    send time from `segment` JSON (e.g., {\"language\":\"sw\",\"channel\":
    \"whatsapp\",\"last_active_within_days\":30})."""
    __tablename__ = "broadcasts"
    id: Mapped[uuid.UUID] = _pk()
    business_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True,
    )
    name: Mapped[str] = mapped_column(String(180))
    channel: Mapped[Channel] = mapped_column(
        Enum(Channel, name="channel_enum", create_type=False),
    )
    # WhatsApp template name (required when outside the 24h window) OR
    # NULL for in-window text. Language code matches the template.
    template_name: Mapped[str | None] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(8), default="en")
    body: Mapped[str | None] = mapped_column(Text)
    segment: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[BroadcastStatus] = mapped_column(
        Enum(BroadcastStatus, name="broadcast_status_enum"),
        default=BroadcastStatus.draft, index=True,
    )
    recipients_total: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WebhookEndpoint(Base):
    """Per-tenant outbound webhook destination. We POST signed JSON to
    the configured URL whenever any of the subscribed event types fires
    (e.g., conversation.escalated, payment.completed, message.created).
    Lets merchants pipe events into their own CRM/Slack/Zapier without
    having to subscribe to the internal Redis bus."""
    __tablename__ = "webhook_endpoints"
    id: Mapped[uuid.UUID] = _pk()
    business_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True,
    )
    url: Mapped[str] = mapped_column(String(512))
    # 32-byte URL-safe random hex; used to sign outbound payloads with
    # HMAC-SHA256 in the `X-Omni-Signature` header. Rotatable.
    secret: Mapped[str] = mapped_column(String(128))
    events: Mapped[list] = mapped_column(JSONB, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BackgroundJob(Base):
    """Durable in-app job queue for work that must survive request/process loss.

    This intentionally stays small: Postgres row locks provide cross-worker
    claiming, and handlers live in app/jobs. It is enough for broadcasts,
    order follow-ups, and demo simulator callbacks without adding Celery/RQ.
    """
    __tablename__ = "background_jobs"
    id: Mapped[uuid.UUID] = _pk()
    business_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    kind: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status_enum"),
        default=JobStatus.queued, index=True,
    )
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    locked_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_background_jobs_due", "status", "run_at"),
    )


class Outbox(Base):
    __tablename__ = "outbox"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    kind: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

