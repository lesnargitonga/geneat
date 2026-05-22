"""enforce 768-dim knowledge embeddings

Revision ID: 0010_enforce_embedding_768
Revises: 0009_background_jobs
Create Date: 2026-05-21

Some long-lived local/beta databases reached head while still carrying the
original ``vector(1536)`` knowledge_base.embedding column. The application and
default Ollama embedder use 768 dimensions, so make the schema self-healing.
The table is seeded content, not source-of-record content; re-run the seed
script after this migration.
"""
from __future__ import annotations

from alembic import op

revision = "0010_enforce_embedding_768"
down_revision = "0009_background_jobs"
branch_labels = None
depends_on = None

NEW_DIM = 768
OLD_DIM = 1536


def _set_dim(dim: int) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                WHERE c.relname = 'knowledge_base'
                  AND a.attname = 'embedding'
                  AND format_type(a.atttypid, a.atttypmod) <> 'vector({dim})'
            ) THEN
                DROP INDEX IF EXISTS ix_knowledge_embedding_hnsw;
                TRUNCATE TABLE knowledge_base;
                ALTER TABLE knowledge_base DROP COLUMN embedding;
                ALTER TABLE knowledge_base ADD COLUMN embedding vector({dim}) NOT NULL;
                CREATE INDEX ix_knowledge_embedding_hnsw ON knowledge_base
                    USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    _set_dim(NEW_DIM)


def downgrade() -> None:
    _set_dim(OLD_DIM)
