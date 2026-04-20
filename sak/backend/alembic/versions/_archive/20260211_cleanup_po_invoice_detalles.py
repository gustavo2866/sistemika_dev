"""remove fields from po_invoice_detalles and rename subtotal to importe

Revision ID: 20260211_cleanup_po_invoice_detalles
Revises: 20260211_remove_fields_and_totales_table
Create Date: 2026-02-11 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260211_cleanup_po_invoice_detalles"
down_revision = "20260211_remove_fields_and_totales_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove fields from po_invoice_detalles and rename subtotal to importe."""
    
    # Drop columns that exist
    op.drop_column('po_invoice_detalles', 'unidad_medida')
    op.drop_column('po_invoice_detalles', 'porcentaje_descuento')
    op.drop_column('po_invoice_detalles', 'importe_descuento')
    op.drop_column('po_invoice_detalles', 'porcentaje_iva')
    op.drop_column('po_invoice_detalles', 'importe_iva')
    op.drop_column('po_invoice_detalles', 'total_linea')
    
    # Rename subtotal to importe
    op.alter_column('po_invoice_detalles', 'subtotal', new_column_name='importe')


def downgrade() -> None:
    """Restore fields to po_invoice_detalles and rename importe back to subtotal."""
    
    # Rename importe back to subtotal
    op.alter_column('po_invoice_detalles', 'importe', new_column_name='subtotal')
    
    # Add columns back
    op.add_column('po_invoice_detalles', sa.Column('unidad_medida', sa.String(10), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('porcentaje_descuento', sa.DECIMAL(5, 2), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('importe_descuento', sa.DECIMAL(15, 2), nullable=True))
    op.add_column('po_invoice_detalles', sa.Column('porcentaje_iva', sa.DECIMAL(5, 2), nullable=False))
    op.add_column('po_invoice_detalles', sa.Column('importe_iva', sa.DECIMAL(15, 2), nullable=False))
    op.add_column('po_invoice_detalles', sa.Column('total_linea', sa.DECIMAL(15, 2), nullable=False))