"""add_estado_calificacion_necesidad_tipo_operacion_to_contactos

Revision ID: 0b5792d2b455
Revises: 75bfd2be3e50
Create Date: 2025-11-29 15:34:38.870662

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b5792d2b455'
down_revision: Union[str, Sequence[str], None] = '75bfd2be3e50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar columna estado_calificacion
    op.add_column('crm_contactos',
        sa.Column('estado_calificacion', sa.String(20), server_default='nuevo', nullable=False)
    )
    op.create_index('idx_contacto_estado_calificacion', 'crm_contactos', ['estado_calificacion'])
    
    # Agregar columna necesidad
    op.add_column('crm_contactos',
        sa.Column('necesidad', sa.String(1000), nullable=True)
    )
    
    # Agregar columna tipo_operacion_interes_id
    op.add_column('crm_contactos',
        sa.Column('tipo_operacion_interes_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_crm_contactos_tipo_operacion_interes',
        'crm_contactos', 'crm_tipos_operacion',
        ['tipo_operacion_interes_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar foreign key y columna tipo_operacion_interes_id
    op.drop_constraint('fk_crm_contactos_tipo_operacion_interes', 'crm_contactos', type_='foreignkey')
    op.drop_column('crm_contactos', 'tipo_operacion_interes_id')
    
    # Eliminar columna necesidad
    op.drop_column('crm_contactos', 'necesidad')
    
    # Eliminar índice y columna estado_calificacion
    op.drop_index('idx_contacto_estado_calificacion', 'crm_contactos')
    op.drop_column('crm_contactos', 'estado_calificacion')
