"""add po_orders_archivos table

Revision ID: f1a2b3c4d5e6
Revises: e3f1a2b4c5d6
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e3f1a2b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS po_orders_archivos (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES po_orders(id),
            nombre VARCHAR(300) NOT NULL,
            tipo VARCHAR(100),
            archivo_url VARCHAR(500) NOT NULL,
            mime_type VARCHAR(100),
            tamanio_bytes INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE,
            version INTEGER NOT NULL DEFAULT 1
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_po_orders_archivos_order_id ON po_orders_archivos (order_id)")
    # Add version column if table already existed without it
    op.execute("""
        ALTER TABLE po_orders_archivos ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS po_orders_archivos")
