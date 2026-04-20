"""add_propiedad_id_to_solicitudes

Revision ID: 5babfc193004
Revises: d2bde5c76f9f
Create Date: 2025-12-31 05:25:26.481389

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5babfc193004'
down_revision: Union[str, Sequence[str], None] = 'd2bde5c76f9f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('solicitudes', sa.Column('propiedad_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_solicitudes_propiedad_id'), 'solicitudes', ['propiedad_id'], unique=False)
    op.create_foreign_key('fk_solicitudes_propiedad_id', 'solicitudes', 'propiedades', ['propiedad_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_solicitudes_propiedad_id', 'solicitudes', type_='foreignkey')
    op.drop_index(op.f('ix_solicitudes_propiedad_id'), table_name='solicitudes')
    op.drop_column('solicitudes', 'propiedad_id')
