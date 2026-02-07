"""Create PoOrder, PoOrderDetail and PoOrderStatus tables

Revision ID: 20260207_create_po_orders_and_status
Revises: 20260206_fix_solicitud_detalle_fk
Create Date: 2026-02-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260207_create_po_orders_and_status'
down_revision: Union[str, Sequence[str], None] = '20260206_fix_solicitud_detalle_fk'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create PoOrder related tables."""
    
    # 1. Create po_order_status table first (referenced by po_orders)
    op.create_table(
        'po_order_status',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('nombre', sa.String(length=50), nullable=False),
        sa.Column('descripcion', sa.String(length=200), nullable=True),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('activo', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('es_inicial', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('es_final', sa.Boolean(), server_default='false', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    
    # 2. Create po_orders table
    op.create_table(
        'po_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('titulo', sa.String(length=200), nullable=False),
        sa.Column('tipo_solicitud_id', sa.Integer(), nullable=False),
        sa.Column('departamento_id', sa.Integer(), nullable=False),
        sa.Column('order_status_id', sa.Integer(), nullable=False),
        sa.Column('total', sa.DECIMAL(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('fecha_necesidad', sa.Date(), nullable=True),
        sa.Column('comentario', sa.String(length=1000), nullable=True),
        sa.Column('solicitante_id', sa.Integer(), nullable=False),
        sa.Column('centro_costo_id', sa.Integer(), nullable=True),
        sa.Column('oportunidad_id', sa.Integer(), nullable=True),
        sa.Column('proveedor_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['centro_costo_id'], ['centros_costo.id']),
        sa.ForeignKeyConstraint(['departamento_id'], ['departamentos.id']),
        sa.ForeignKeyConstraint(['oportunidad_id'], ['crm_oportunidades.id']),
        sa.ForeignKeyConstraint(['order_status_id'], ['po_order_status.id']),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id']),
        sa.ForeignKeyConstraint(['solicitante_id'], ['users.id']),
        sa.ForeignKeyConstraint(['tipo_solicitud_id'], ['tipos_solicitud.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_po_orders_oportunidad_id', 'po_orders', ['oportunidad_id'])
    op.create_index('ix_po_orders_proveedor_id', 'po_orders', ['proveedor_id'])
    op.create_index('ix_po_orders_order_status_id', 'po_orders', ['order_status_id'])
    
    # 3. Create po_order_details table
    op.create_table(
        'po_order_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('articulo_id', sa.Integer(), nullable=True),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('unidad_medida', sa.String(length=50), nullable=True),
        sa.Column('cantidad', sa.DECIMAL(precision=12, scale=3), nullable=False),
        sa.Column('precio', sa.DECIMAL(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('importe', sa.DECIMAL(precision=15, scale=2), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['articulo_id'], ['articulos.id']),
        sa.ForeignKeyConstraint(['order_id'], ['po_orders.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_po_order_details_order_id', 'po_order_details', ['order_id'])
    op.create_index('ix_po_order_details_articulo_id', 'po_order_details', ['articulo_id'])
    
    # 4. Insert initial status data
    op.execute("""
        INSERT INTO po_order_status (nombre, descripcion, orden, activo, es_inicial, es_final) VALUES
        ('borrador', 'Orden en estado borrador', 1, true, true, false),
        ('pendiente', 'Orden pendiente de aprobación', 2, true, false, false),
        ('cotizada', 'Orden con cotización obtenida', 3, true, false, false),
        ('aprobada', 'Orden aprobada para procesamiento', 4, true, false, false),
        ('rechazada', 'Orden rechazada', 5, true, false, true),
        ('en_proceso', 'Orden en proceso de ejecución', 6, true, false, false),
        ('finalizada', 'Orden completada exitosamente', 7, true, false, true)
    """)


def downgrade() -> None:
    """Drop PoOrder related tables."""
    
    # Drop in reverse order due to foreign key constraints
    op.drop_index('ix_po_order_details_articulo_id', 'po_order_details')
    op.drop_index('ix_po_order_details_order_id', 'po_order_details')
    op.drop_table('po_order_details')
    
    op.drop_index('ix_po_orders_order_status_id', 'po_orders')
    op.drop_index('ix_po_orders_proveedor_id', 'po_orders')
    op.drop_index('ix_po_orders_oportunidad_id', 'po_orders')
    op.drop_table('po_orders')
    
    op.drop_table('po_order_status')