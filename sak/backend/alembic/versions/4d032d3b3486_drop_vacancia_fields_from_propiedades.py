"""drop_vacancia_fields_from_propiedades

Revision ID: 4d032d3b3486
Revises: 4c1a4005406c
Create Date: 2026-02-21 07:25:05.340323

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d032d3b3486'
down_revision: Union[str, Sequence[str], None] = '4c1a4005406c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Drop vacancia fields from propiedades table."""
    # Drop vacancia_activa and vacancia_fecha columns
    op.drop_column('propiedades', 'vacancia_fecha')
    op.drop_column('propiedades', 'vacancia_activa')


def downgrade() -> None:
    """Downgrade schema - Recreate vacancia fields in propiedades table."""
    # Recreate vacancia_activa and vacancia_fecha columns
    op.add_column('propiedades', sa.Column('vacancia_activa', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('propiedades', sa.Column('vacancia_fecha', sa.Date(), nullable=True))
