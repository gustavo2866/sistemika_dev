"""add_vacancia_fields_to_propiedades

Revision ID: a47c8a439706
Revises: 4d032d3b3486
Create Date: 2026-02-21 16:35:47.458095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a47c8a439706'
down_revision: Union[str, Sequence[str], None] = '4d032d3b3486'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add vacancia fields to propiedades table."""
    # Add vacancia_activa column
    op.add_column('propiedades', sa.Column('vacancia_activa', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add vacancia_fecha column
    op.add_column('propiedades', sa.Column('vacancia_fecha', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema - Remove vacancia fields from propiedades table."""
    # Drop vacancia fields
    op.drop_column('propiedades', 'vacancia_fecha')
    op.drop_column('propiedades', 'vacancia_activa')
