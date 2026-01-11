"""Update PO models - rename numero to titulo, remove unnecessary fields

Revision ID: 20260110_update_po_models_cleanup
Revises: 20260110_make_solicitud_detalle_id_optional
Create Date: 2026-01-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260110_update_po_models_cleanup'
down_revision = '20260110_make_solicitud_detalle_id_optional'
branch_labels = None
depends_on = None


def upgrade():
    # PoOrdenCompra changes
    # Rename numero to titulo
    op.alter_column('po_ordenes_compra', 'numero', new_column_name='titulo')
    
    # Remove unnecessary columns
    op.drop_column('po_ordenes_compra', 'fecha_emision')
    op.drop_column('po_ordenes_compra', 'fecha_recepcion')
    op.drop_column('po_ordenes_compra', 'registrado_por_id')
    
    # PoOrdenCompraDetalle changes
    # Remove unnecessary columns
    op.drop_column('po_orden_compra_detalles', 'codigo_producto')
    op.drop_column('po_orden_compra_detalles', 'orden')
    
    # PoFactura changes
    # Remove unnecessary columns
    op.drop_column('po_facturas', 'fecha_recepcion')
    op.drop_column('po_facturas', 'tipo_operacion_id')
    op.drop_column('po_facturas', 'propiedad_id')


def downgrade():
    # Restore PoFactura columns
    op.add_column('po_facturas', sa.Column('propiedad_id', sa.INTEGER(), nullable=True))
    op.add_column('po_facturas', sa.Column('tipo_operacion_id', sa.INTEGER(), nullable=False))
    op.add_column('po_facturas', sa.Column('fecha_recepcion', sa.TIMESTAMP(), nullable=False, server_default=sa.text('now()')))
    
    # Restore foreign key constraints
    op.create_foreign_key('po_facturas_propiedad_id_fkey', 'po_facturas', 'propiedades', ['propiedad_id'], ['id'])
    op.create_foreign_key('po_facturas_tipo_operacion_id_fkey', 'po_facturas', 'tipos_operacion', ['tipo_operacion_id'], ['id'])
    
    # Restore PoOrdenCompraDetalle columns
    op.add_column('po_orden_compra_detalles', sa.Column('orden', sa.INTEGER(), nullable=False))
    op.add_column('po_orden_compra_detalles', sa.Column('codigo_producto', sa.VARCHAR(length=50), nullable=True))
    
    # Restore PoOrdenCompra columns
    op.add_column('po_ordenes_compra', sa.Column('registrado_por_id', sa.INTEGER(), nullable=False, server_default='1'))
    op.add_column('po_ordenes_compra', sa.Column('fecha_recepcion', sa.TIMESTAMP(), nullable=False, server_default=sa.text('now()')))
    op.add_column('po_ordenes_compra', sa.Column('fecha_emision', sa.DATE(), nullable=False))
    
    # Restore foreign key constraint
    op.create_foreign_key('po_ordenes_compra_registrado_por_id_fkey', 'po_ordenes_compra', 'users', ['registrado_por_id'], ['id'])
    
    # Rename titulo back to numero
    op.alter_column('po_ordenes_compra', 'titulo', new_column_name='numero')