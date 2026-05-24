"""payment locking and job ttl

Revision ID: 0011_payment_locking_and_job_ttl
Revises: 0010_enforce_embedding_768
Create Date: 2026-05-24
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0011_payment_locking_and_job_ttl"
down_revision = "0010_enforce_embedding_768"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("payment_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "background_jobs",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_background_jobs_expires_at", "background_jobs", ["expires_at"])
    op.alter_column("orders", "payment_version", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_background_jobs_expires_at", table_name="background_jobs")
    op.drop_column("background_jobs", "expires_at")
    op.drop_column("orders", "payment_version")
