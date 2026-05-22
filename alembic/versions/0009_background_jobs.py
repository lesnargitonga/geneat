"""durable background jobs

Revision ID: 0009_background_jobs
Revises: 0008_orders_business_id
Create Date: 2026-05-21

Adds a compact database-backed job queue for request-detached work that must
survive process restarts: broadcasts, order-ready notifications, and demo
payment callbacks. Postgres row locks are used by the worker to claim due jobs
across multiple API workers.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_background_jobs"
down_revision = "0008_orders_business_id"
branch_labels = None
depends_on = None


job_status_enum = sa.Enum(
    "queued", "running", "done", "failed", "cancelled",
    name="job_status_enum",
)
job_status_col = postgresql.ENUM(name="job_status_enum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    job_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "background_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("status", job_status_col, nullable=False, server_default="queued"),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default="3"),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("locked_by", sa.String(128), nullable=True),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_background_jobs_business_id", "background_jobs", ["business_id"])
    op.create_index("ix_background_jobs_kind", "background_jobs", ["kind"])
    op.create_index("ix_background_jobs_status", "background_jobs", ["status"])
    op.create_index("ix_background_jobs_run_at", "background_jobs", ["run_at"])
    op.create_index("ix_background_jobs_locked_until", "background_jobs", ["locked_until"])
    op.create_index("ix_background_jobs_due", "background_jobs", ["status", "run_at"])


def downgrade() -> None:
    op.drop_index("ix_background_jobs_due", table_name="background_jobs")
    op.drop_index("ix_background_jobs_locked_until", table_name="background_jobs")
    op.drop_index("ix_background_jobs_run_at", table_name="background_jobs")
    op.drop_index("ix_background_jobs_status", table_name="background_jobs")
    op.drop_index("ix_background_jobs_kind", table_name="background_jobs")
    op.drop_index("ix_background_jobs_business_id", table_name="background_jobs")
    op.drop_table("background_jobs")
    job_status_enum.drop(op.get_bind(), checkfirst=True)
