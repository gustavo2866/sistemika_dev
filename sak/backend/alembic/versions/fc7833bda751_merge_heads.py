"""Merge heads

Revision ID: fc7833bda751
Revises: 20251222_allow_null_fecha_evento, 20251223_drop_tipo_evento
Create Date: 2025-12-30 20:36:52.375404

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc7833bda751'
down_revision: Union[str, Sequence[str], None] = ('20251222_allow_null_fecha_evento', '20251223_drop_tipo_evento')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
