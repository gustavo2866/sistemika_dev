"""add_padron_to_propiedades

Revision ID: e3f1a2b4c5d6
Revises: cd2c2491ff7c
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f1a2b4c5d6'
down_revision: Union[str, Sequence[str], None] = '20260412_contrato_estados_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        ALTER TABLE propiedades
            ADD COLUMN IF NOT EXISTS padron VARCHAR(200)
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        ALTER TABLE propiedades
            DROP COLUMN IF EXISTS padron
    """)
