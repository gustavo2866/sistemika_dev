"""squash_initial_20260419

Revisión de squash: condensa todo el historial de migraciones anteriores.
La base de datos ya tiene el schema completo aplicado — este archivo es el
nuevo punto de partida. Las migraciones futuras deben encadenarse desde aquí.

Revision ID: dec3dfc250f3
Revises: 
Create Date: 2026-04-19 21:23:52.654276

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dec3dfc250f3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
