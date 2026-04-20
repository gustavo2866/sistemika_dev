"""add servicios_tipo table

Revision ID: c3d4e5f6a1b2
Revises: f1a2b3c4d5e6
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a1b2"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS servicios_tipo (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            url VARCHAR(500),
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE,
            version INTEGER NOT NULL DEFAULT 1
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS servicios_tipo")
