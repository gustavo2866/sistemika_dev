"""solo_agregar_tipo_propiedad_id_fk

Revision ID: 8591e8a24586
Revises: e484951a2e2c
Create Date: 2026-02-19 16:37:18.311545

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8591e8a24586'
down_revision: Union[str, Sequence[str], None] = 'e484951a2e2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar columna tipo_propiedad_id a tabla propiedades."""
    # Agregar columna tipo_propiedad_id
    op.add_column('propiedades', sa.Column('tipo_propiedad_id', sa.Integer(), nullable=True))
    
    # Crear índice para la nueva columna
    op.create_index(op.f('ix_propiedades_tipo_propiedad_id'), 'propiedades', ['tipo_propiedad_id'], unique=False)
    
    # Crear foreign key constraint
    op.create_foreign_key('fk_propiedades_tipo_propiedad_id', 'propiedades', 'tipos_propiedad', ['tipo_propiedad_id'], ['id'])


def downgrade() -> None:
    """Remover columna tipo_propiedad_id de tabla propiedades."""
    # Eliminar foreign key constraint
    op.drop_constraint('fk_propiedades_tipo_propiedad_id', 'propiedades', type_='foreignkey')
    
    # Eliminar índice
    op.drop_index(op.f('ix_propiedades_tipo_propiedad_id'), table_name='propiedades')
    
    # Eliminar columna
    op.drop_column('propiedades', 'tipo_propiedad_id')
