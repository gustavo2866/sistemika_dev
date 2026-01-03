"""remove_propiedad_id_from_solicitudes

Revision ID: d9b5e64b9f48
Revises: 5babfc193004
Create Date: 2026-01-03 07:41:02.100163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9b5e64b9f48'
down_revision: Union[str, Sequence[str], None] = '5babfc193004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint('fk_solicitudes_propiedad_id', 'solicitudes', type_='foreignkey')
    op.drop_index(op.f('ix_solicitudes_propiedad_id'), table_name='solicitudes')
    op.drop_column('solicitudes', 'propiedad_id')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('solicitudes', sa.Column('propiedad_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_solicitudes_propiedad_id'), 'solicitudes', ['propiedad_id'], unique=False)
    op.create_foreign_key('fk_solicitudes_propiedad_id', 'solicitudes', 'propiedades', ['propiedad_id'], ['id'])
