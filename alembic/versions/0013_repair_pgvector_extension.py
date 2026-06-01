"""repair pgvector extension drift

Revision ID: 0013_repair_pgvector_extension
Revises: 0012_add_outbox_table
Create Date: 2026-06-01

Some managed Postgres cutovers can end up with the schema stamped at head while
the ``vector`` extension is missing. The app can pass basic readiness in that
state, but RAG/Hazina tenant auto-provisioning can fail at runtime. Re-create
the extension as an explicit, idempotent drift repair.
"""
from __future__ import annotations

from alembic import op


revision = "0013_repair_pgvector_extension"
down_revision = "0012_add_outbox_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    # Keep pgvector installed. Older revisions still depend on vector columns.
    pass
