"""switch knowledge_base embedding to 768 dims (nomic-embed-text)

Revision ID: 0002_embed_768
Revises: 0001_init
Create Date: 2026-05-18

The Phase-2 schema sized embeddings at 1536 for OpenAI text-embedding-3-small.
We've switched to local Ollama with nomic-embed-text which is 768-dim. Since
the knowledge_base table is empty at this point (seeded by scripts/seed_demo.py
*after* this runs), we just drop & re-add the column and re-create the HNSW
index. If you have seeded data and need to keep it, re-run scripts/seed_demo.py
after this migration.
"""
from __future__ import annotations

from alembic import op

revision = "0002_embed_768"
down_revision = "0001_init"
branch_labels = None
depends_on = None

NEW_DIM = 768
OLD_DIM = 1536


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_knowledge_embedding_hnsw")
    # Wipe the (assumed-empty) table contents rather than try to re-embed in SQL.
    op.execute("TRUNCATE TABLE knowledge_base")
    op.drop_column("knowledge_base", "embedding")
    op.execute(f"ALTER TABLE knowledge_base ADD COLUMN embedding vector({NEW_DIM}) NOT NULL")
    op.execute(
        "CREATE INDEX ix_knowledge_embedding_hnsw ON knowledge_base "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_knowledge_embedding_hnsw")
    op.execute("TRUNCATE TABLE knowledge_base")
    op.drop_column("knowledge_base", "embedding")
    op.execute(f"ALTER TABLE knowledge_base ADD COLUMN embedding vector({OLD_DIM}) NOT NULL")
    op.execute(
        "CREATE INDEX ix_knowledge_embedding_hnsw ON knowledge_base "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )
