"""add centro_costo and quantities to po tables

Revision ID: 20250110_add_centro_costo_and_quantities_to_po
Revises: 5d0d351a82c7
Create Date: 2025-01-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20250110_add_centro_costo_and_quantities_to_po'
down_revision: Union[str, Sequence[str], Sequence[str], None] = '5d0d351a82c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add centro_costo columns and quantity fields to PO tables."""
    
    # 1. Agregar campos de cantidad a po_orden_compra_detalles
    op.add_column('po_orden_compra_detalles', sa.Column('cantidad_recibida', sa.DECIMAL(precision=10, scale=3), server_default='0', nullable=False))
    op.add_column('po_orden_compra_detalles', sa.Column('cantidad_facturada', sa.DECIMAL(precision=10, scale=3), server_default='0', nullable=False))
    
    # 2. Agregar centro_costo_id a po_ordenes_compra (cabecera)
    op.add_column('po_ordenes_compra', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_po_ordenes_compra_centro_costo', 'po_ordenes_compra', 'centros_costo', ['centro_costo_id'], ['id'])
    
    # 3. Agregar centro_costo_id a po_orden_compra_detalles
    op.add_column('po_orden_compra_detalles', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_po_orden_compra_detalles_centro_costo', 'po_orden_compra_detalles', 'centros_costo', ['centro_costo_id'], ['id'])
    
    # 4. Agregar centro_costo_id a po_facturas (cabecera)
    op.add_column('po_facturas', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_po_facturas_centro_costo', 'po_facturas', 'centros_costo', ['centro_costo_id'], ['id'])
    
    # 5. Agregar centro_costo_id a po_factura_detalles
    op.add_column('po_factura_detalles', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_po_factura_detalles_centro_costo', 'po_factura_detalles', 'centros_costo', ['centro_costo_id'], ['id'])


def downgrade() -> None:
    """Remove centro_costo columns and quantity fields from PO tables."""
    
    # 1. Remover foreign keys
    op.drop_constraint('fk_po_factura_detalles_centro_costo', 'po_factura_detalles', type_='foreignkey')
    op.drop_constraint('fk_po_facturas_centro_costo', 'po_facturas', type_='foreignkey')
    op.drop_constraint('fk_po_orden_compra_detalles_centro_costo', 'po_orden_compra_detalles', type_='foreignkey')
    op.drop_constraint('fk_po_ordenes_compra_centro_costo', 'po_ordenes_compra', type_='foreignkey')
    
    # 2. Remover columnas centro_costo_id
    op.drop_column('po_factura_detalles', 'centro_costo_id')
    op.drop_column('po_facturas', 'centro_costo_id')
    op.drop_column('po_orden_compra_detalles', 'centro_costo_id')
    op.drop_column('po_ordenes_compra', 'centro_costo_id')
    
    # 3. Remover campos de cantidad
    op.drop_column('po_orden_compra_detalles', 'cantidad_facturada')
    op.drop_column('po_orden_compra_detalles', 'cantidad_recibida')