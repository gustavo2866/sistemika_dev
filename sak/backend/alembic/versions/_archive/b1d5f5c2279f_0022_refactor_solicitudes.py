"""0022_refactor_solicitudes

Revision ID: b1d5f5c2279f
Revises: c0a618facd27
Create Date: 2025-11-10 19:24:32.557492

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1d5f5c2279f'
down_revision: Union[str, Sequence[str], None] = 'c0a618facd27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Refactor tabla solicitudes."""
    # 1. Agregar nuevas columnas (nullable temporalmente)
    op.add_column('solicitudes', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    op.add_column('solicitudes', sa.Column('departamento_id', sa.Integer(), nullable=True))
    op.add_column('solicitudes', sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente'))
    op.add_column('solicitudes', sa.Column('total', sa.DECIMAL(15, 2), nullable=False, server_default='0'))
    
    # 2. Asignar tipo_solicitud_id a NULL temporalmente (se asignará manualmente después)
    #    Las solicitudes existentes necesitarán ser reasignadas a uno de los nuevos tipos
    
    # 3. Asignar departamento "Compras" a todas las solicitudes existentes
    op.execute("""
        UPDATE solicitudes s
        SET departamento_id = d.id
        FROM departamentos d
        WHERE d.nombre = 'Compras'
    """)
    
    # 4. Para solicitudes sin tipo_solicitud_id, asignar el primer tipo disponible (temporal)
    #    IMPORTANTE: Revisar manualmente estas solicitudes después de la migración
    op.execute("""
        UPDATE solicitudes s
        SET tipo_solicitud_id = (SELECT id FROM tipos_solicitud ORDER BY id LIMIT 1)
        WHERE tipo_solicitud_id IS NULL
    """)
    
    # 5. Hacer columnas NOT NULL
    op.alter_column('solicitudes', 'tipo_solicitud_id', nullable=False)
    op.alter_column('solicitudes', 'departamento_id', nullable=False)
    
    # 6. Crear foreign keys
    op.create_foreign_key(
        'fk_solicitudes_tipo_solicitud',
        'solicitudes', 'tipos_solicitud',
        ['tipo_solicitud_id'], ['id']
    )
    op.create_foreign_key(
        'fk_solicitudes_departamento',
        'solicitudes', 'departamentos',
        ['departamento_id'], ['id']
    )
    
    # 7. Eliminar columna tipo (enum) antigua
    op.drop_column('solicitudes', 'tipo')


def downgrade() -> None:
    """Downgrade schema - Revertir refactor de solicitudes."""
    # 1. Agregar columna tipo antigua
    op.add_column('solicitudes', sa.Column('tipo', sa.String(20), nullable=False, server_default='normal'))
    
    # 2. Mapear estado a tipo (simplificación: todo a 'normal')
    op.execute("UPDATE solicitudes SET tipo = 'normal'")
    
    # 3. Eliminar foreign keys
    op.drop_constraint('fk_solicitudes_tipo_solicitud', 'solicitudes', type_='foreignkey')
    op.drop_constraint('fk_solicitudes_departamento', 'solicitudes', type_='foreignkey')
    
    # 4. Eliminar columnas nuevas
    op.drop_column('solicitudes', 'total')
    op.drop_column('solicitudes', 'estado')
    op.drop_column('solicitudes', 'departamento_id')
    op.drop_column('solicitudes', 'tipo_solicitud_id')
