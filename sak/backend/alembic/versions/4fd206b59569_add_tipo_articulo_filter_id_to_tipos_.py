"""Add tipo_articulo_filter_id to tipos_solicitud

Revision ID: 4fd206b59569
Revises: 39ad05242d89
Create Date: 2026-01-09 08:24:18.083451

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fd206b59569'
down_revision: Union[str, Sequence[str], None] = '39ad05242d89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar nueva columna tipo_articulo_filter_id
    op.add_column('tipos_solicitud', sa.Column('tipo_articulo_filter_id', sa.Integer(), nullable=True))
    
    # Crear foreign key constraint
    op.create_foreign_key(
        'fk_tipos_solicitud_tipo_articulo_filter_id', 
        'tipos_solicitud', 
        'tipos_articulo', 
        ['tipo_articulo_filter_id'], 
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar foreign key constraint
    op.drop_constraint('fk_tipos_solicitud_tipo_articulo_filter_id', 'tipos_solicitud', type_='foreignkey')
    
    # Eliminar columna tipo_articulo_filter_id
    op.drop_column('tipos_solicitud', 'tipo_articulo_filter_id')
