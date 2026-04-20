"""drop_solicitudes_legacy_tables

Revision ID: 3460bb40d6db
Revises: 11e093cdd37c
Create Date: 2026-02-04 01:31:11.103540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3460bb40d6db'
down_revision: Union[str, Sequence[str], None] = '11e093cdd37c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Eliminar tablas legacy de solicitudes."""
    # Eliminar primero solicitud_detalles (tiene FK a solicitudes)
    op.drop_table('solicitud_detalles')
    # Luego eliminar solicitudes
    op.drop_table('solicitudes')


def downgrade() -> None:
    """Downgrade schema - Recrear tablas legacy (solo estructura básica)."""
    # NOTA: Esta recreación es solo para emergencias y no incluye datos
    
    # Recrear tabla solicitudes (estructura simplificada)
    op.create_table(
        'solicitudes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tipo_solicitud_id', sa.Integer(), nullable=False),
        sa.Column('departamento_id', sa.Integer(), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente'),
        sa.Column('total', sa.DECIMAL(15, 2), nullable=False, server_default='0'),
        sa.Column('fecha_necesidad', sa.Date(), nullable=False),
        sa.Column('comentario', sa.String(1000), nullable=True),
        sa.Column('solicitante_id', sa.Integer(), nullable=False),
        sa.Column('centro_costo_id', sa.Integer(), nullable=False),
        sa.Column('oportunidad_id', sa.Integer(), nullable=True),
        sa.Column('proveedor_id', sa.Integer(), nullable=True),
        sa.Column('tipo_compra', sa.String(20), nullable=False, server_default='normal'),
        sa.ForeignKeyConstraint(['centro_costo_id'], ['centros_costo.id']),
        sa.ForeignKeyConstraint(['departamento_id'], ['departamentos.id']),
        sa.ForeignKeyConstraint(['oportunidad_id'], ['crm_oportunidades.id']),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id']),
        sa.ForeignKeyConstraint(['solicitante_id'], ['users.id']),
        sa.ForeignKeyConstraint(['tipo_solicitud_id'], ['tipos_solicitud.id']),
    )
    
    # Recrear tabla solicitud_detalles  
    op.create_table(
        'solicitud_detalles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('solicitud_id', sa.Integer(), nullable=False),
        sa.Column('articulo_id', sa.Integer(), nullable=True),
        sa.Column('descripcion', sa.String(500), nullable=False),
        sa.Column('unidad_medida', sa.String(50), nullable=True),
        sa.Column('cantidad', sa.DECIMAL(12, 3), nullable=False),
        sa.Column('precio', sa.DECIMAL(15, 2), nullable=False, server_default='0'),
        sa.Column('importe', sa.DECIMAL(15, 2), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['articulo_id'], ['articulos.id']),
        sa.ForeignKeyConstraint(['solicitud_id'], ['solicitudes.id']),
    )
