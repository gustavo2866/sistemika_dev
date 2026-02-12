"""Add missing fields to PoInvoice system tables

Revision ID: 20260211_add_missing_invoice_fields
Revises: 68a83e16094c
Create Date: 2026-02-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260211_add_missing_invoice_fields'
down_revision: Union[str, Sequence[str], None] = '68a83e16094c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing fields to PoInvoice tables."""
    
    # Add missing fields to po_invoices
    op.add_column('po_invoices', sa.Column('id_tipocomprobante', sa.Integer(), nullable=True))
    op.add_column('po_invoices', sa.Column('nombre_archivo_pdf', sa.String(length=500), nullable=True))
    op.add_column('po_invoices', sa.Column('ruta_archivo_pdf', sa.String(length=1000), nullable=True))
    op.add_column('po_invoices', sa.Column('comprobante_id', sa.Integer(), nullable=True))
    op.add_column('po_invoices', sa.Column('metodo_pago_id', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('po_invoices', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    op.add_column('po_invoices', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    op.add_column('po_invoices', sa.Column('oportunidad_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraints for po_invoices
    op.create_foreign_key('fk_po_invoices_id_tipocomprobante', 'po_invoices', 'tipos_comprobante', ['id_tipocomprobante'], ['id'])
    op.create_foreign_key('fk_po_invoices_comprobante', 'po_invoices', 'comprobantes', ['comprobante_id'], ['id'])
    op.create_foreign_key('fk_po_invoices_metodo_pago', 'po_invoices', 'metodos_pago', ['metodo_pago_id'], ['id'])
    op.create_foreign_key('fk_po_invoices_centro_costo', 'po_invoices', 'centros_costo', ['centro_costo_id'], ['id'])
    op.create_foreign_key('fk_po_invoices_tipo_solicitud', 'po_invoices', 'tipos_solicitud', ['tipo_solicitud_id'], ['id'])
    op.create_foreign_key('fk_po_invoices_oportunidad', 'po_invoices', 'crm_oportunidades', ['oportunidad_id'], ['id'])
    
    # Add missing fields to po_invoice_detalles
    op.add_column('po_invoice_detalles', sa.Column('unidad_medida', sa.String(length=10), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('porcentaje_descuento', sa.DECIMAL(precision=5, scale=2), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('importe_descuento', sa.DECIMAL(precision=15, scale=2), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('porcentaje_iva', sa.DECIMAL(precision=5, scale=2), nullable=False, server_default='0'))
    op.add_column('po_invoice_detalles', sa.Column('importe_iva', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0'))
    op.add_column('po_invoice_detalles', sa.Column('total_linea', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0'))
    op.add_column('po_invoice_detalles', sa.Column('articulo_id', sa.Integer(), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('oportunidad_id', sa.Integer(), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('poOrderDetail_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraints for po_invoice_detalles
    op.create_foreign_key('fk_po_invoice_detalles_articulo', 'po_invoice_detalles', 'articulos', ['articulo_id'], ['id'])
    op.create_foreign_key('fk_po_invoice_detalles_centro_costo', 'po_invoice_detalles', 'centros_costo', ['centro_costo_id'], ['id'])
    op.create_foreign_key('fk_po_invoice_detalles_oportunidad', 'po_invoice_detalles', 'crm_oportunidades', ['oportunidad_id'], ['id'])
    op.create_foreign_key('fk_po_invoice_detalles_poOrderDetail', 'po_invoice_detalles', 'po_order_details', ['poOrderDetail_id'], ['id'])
    
    # Update precio_unitario precision in existing column
    op.alter_column('po_invoice_detalles', 'precio_unitario', type_=sa.DECIMAL(precision=15, scale=4))


def downgrade() -> None:
    """Remove added fields from PoInvoice tables."""
    
    # Remove foreign key constraints for po_invoice_detalles
    op.drop_constraint('fk_po_invoice_detalles_articulo', 'po_invoice_detalles', type_='foreignkey')
    op.drop_constraint('fk_po_invoice_detalles_centro_costo', 'po_invoice_detalles', type_='foreignkey')
    op.drop_constraint('fk_po_invoice_detalles_oportunidad', 'po_invoice_detalles', type_='foreignkey')
    op.drop_constraint('fk_po_invoice_detalles_poOrderDetail', 'po_invoice_detalles', type_='foreignkey')
    
    # Remove columns from po_invoice_detalles
    op.drop_column('po_invoice_detalles', 'poOrderDetail_id')
    op.drop_column('po_invoice_detalles', 'oportunidad_id')
    op.drop_column('po_invoice_detalles', 'centro_costo_id')
    op.drop_column('po_invoice_detalles', 'articulo_id')
    op.drop_column('po_invoice_detalles', 'total_linea')
    op.drop_column('po_invoice_detalles', 'importe_iva')
    op.drop_column('po_invoice_detalles', 'porcentaje_iva')
    op.drop_column('po_invoice_detalles', 'importe_descuento')
    op.drop_column('po_invoice_detalles', 'porcentaje_descuento')
    op.drop_column('po_invoice_detalles', 'unidad_medida')
    
    # Remove foreign key constraints for po_invoices
    op.drop_constraint('fk_po_invoices_oportunidad', 'po_invoices', type_='foreignkey')
    op.drop_constraint('fk_po_invoices_tipo_solicitud', 'po_invoices', type_='foreignkey')
    op.drop_constraint('fk_po_invoices_centro_costo', 'po_invoices', type_='foreignkey')
    op.drop_constraint('fk_po_invoices_metodo_pago', 'po_invoices', type_='foreignkey')
    op.drop_constraint('fk_po_invoices_comprobante', 'po_invoices', type_='foreignkey')
    op.drop_constraint('fk_po_invoices_id_tipocomprobante', 'po_invoices', type_='foreignkey')
    
    # Remove columns from po_invoices
    op.drop_column('po_invoices', 'oportunidad_id')
    op.drop_column('po_invoices', 'tipo_solicitud_id')
    op.drop_column('po_invoices', 'centro_costo_id')
    op.drop_column('po_invoices', 'metodo_pago_id')
    op.drop_column('po_invoices', 'comprobante_id')
    op.drop_column('po_invoices', 'ruta_archivo_pdf')
    op.drop_column('po_invoices', 'nombre_archivo_pdf')
    op.drop_column('po_invoices', 'id_tipocomprobante')