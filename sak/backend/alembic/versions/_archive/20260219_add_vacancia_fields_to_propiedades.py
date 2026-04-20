"""Add vacancia fields to propiedades

Revision ID: 20260219_add_vacancia_fields_to_propiedades
Revises: 20260219_create_propiedades_status
Create Date: 2026-02-19 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260219_add_vacancia_fields_to_propiedades'
down_revision: Union[str, Sequence[str], None] = '20260219_create_propiedades_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add vacancia_activa and vacancia_fecha fields to propiedades table."""
    
    # Add vacancia_activa column
    op.add_column('propiedades', sa.Column('vacancia_activa', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add vacancia_fecha column
    op.add_column('propiedades', sa.Column('vacancia_fecha', sa.Date(), nullable=True))


def downgrade() -> None:
    """Remove vacancia_activa and vacancia_fecha fields from propiedades table."""
    
    # Drop vacancia fields
    op.drop_column('propiedades', 'vacancia_fecha')
    op.drop_column('propiedades', 'vacancia_activa')