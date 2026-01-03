"""add_oportunidad_and_proveedor_to_solicitudes

Revision ID: ae80ff90f949
Revises: d9b5e64b9f48
Create Date: 2026-01-03 07:43:45.849288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae80ff90f949'
down_revision: Union[str, Sequence[str], None] = 'd9b5e64b9f48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('solicitudes', sa.Column('oportunidad_id', sa.Integer(), nullable=True))
    op.add_column('solicitudes', sa.Column('proveedor_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_solicitudes_oportunidad_id'), 'solicitudes', ['oportunidad_id'], unique=False)
    op.create_index(op.f('ix_solicitudes_proveedor_id'), 'solicitudes', ['proveedor_id'], unique=False)
    op.create_foreign_key('fk_solicitudes_oportunidad_id', 'solicitudes', 'crm_oportunidades', ['oportunidad_id'], ['id'])
    op.create_foreign_key('fk_solicitudes_proveedor_id', 'solicitudes', 'proveedores', ['proveedor_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_solicitudes_proveedor_id', 'solicitudes', type_='foreignkey')
    op.drop_constraint('fk_solicitudes_oportunidad_id', 'solicitudes', type_='foreignkey')
    op.drop_index(op.f('ix_solicitudes_proveedor_id'), table_name='solicitudes')
    op.drop_index(op.f('ix_solicitudes_oportunidad_id'), table_name='solicitudes')
    op.drop_column('solicitudes', 'proveedor_id')
    op.drop_column('solicitudes', 'oportunidad_id')
