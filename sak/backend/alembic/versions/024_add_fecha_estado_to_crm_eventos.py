"""add_fecha_estado_to_crm_eventos

Revision ID: 024_add_fecha_estado_eventos
Revises: 0ac630b9ebad
Create Date: 2025-12-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '024_add_fecha_estado_eventos'
down_revision: Union[str, Sequence[str], None] = '0ac630b9ebad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar campo fecha_estado a crm_eventos para trackear cambios de estado."""
    
    # Agregar columna fecha_estado (nullable inicialmente)
    op.add_column('crm_eventos', sa.Column('fecha_estado', sa.DateTime(), nullable=True))
    
    # Inicializar fecha_estado con fecha_evento para registros existentes
    # Asumimos que la fecha del estado coincide con la fecha del evento
    op.execute("""
        UPDATE crm_eventos 
        SET fecha_estado = fecha_evento 
        WHERE fecha_estado IS NULL
    """)
    
    # Crear índice para consultas por fecha de estado
    op.create_index(op.f('ix_crm_eventos_fecha_estado'), 'crm_eventos', ['fecha_estado'], unique=False)


def downgrade() -> None:
    """Revertir cambios - eliminar fecha_estado de crm_eventos."""
    
    # Eliminar índice
    op.drop_index(op.f('ix_crm_eventos_fecha_estado'), table_name='crm_eventos')
    
    # Eliminar columna
    op.drop_column('crm_eventos', 'fecha_estado')
