"""update_oportunidad_add_prospect_activo_remove_cotizacion

Revision ID: 4c2774dab77a
Revises: 0b5792d2b455
Create Date: 2025-11-29 16:09:45.753926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c2774dab77a'
down_revision: Union[str, Sequence[str], None] = '0b5792d2b455'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar columna activo
    op.add_column('crm_oportunidades',
        sa.Column('activo', sa.Boolean(), server_default='true', nullable=False)
    )
    op.create_index('idx_oportunidad_activo', 'crm_oportunidades', ['activo'])
    
    # Modificar tipo_operacion_id a nullable
    op.alter_column('crm_oportunidades', 'tipo_operacion_id',
        existing_type=sa.Integer(),
        nullable=True
    )
    
    # Eliminar columna cotizacion_aplicada
    op.drop_column('crm_oportunidades', 'cotizacion_aplicada')
    
    # Nota: El cambio de default del estado a '0-prospect' se aplica solo a nuevos registros
    # Los registros existentes mantienen sus estados actuales


def downgrade() -> None:
    """Downgrade schema."""
    # Re-agregar columna cotizacion_aplicada
    op.add_column('crm_oportunidades',
        sa.Column('cotizacion_aplicada', sa.DECIMAL(18, 6), nullable=True)
    )
    
    # Revertir tipo_operacion_id a NOT NULL
    # Primero actualizar NULLs si existen
    op.execute("UPDATE crm_oportunidades SET tipo_operacion_id = 1 WHERE tipo_operacion_id IS NULL")
    op.alter_column('crm_oportunidades', 'tipo_operacion_id',
        existing_type=sa.Integer(),
        nullable=False
    )
    
    # Eliminar índice y columna activo
    op.drop_index('idx_oportunidad_activo', 'crm_oportunidades')
    op.drop_column('crm_oportunidades', 'activo')
