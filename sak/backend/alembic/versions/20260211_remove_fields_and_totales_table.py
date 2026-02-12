"""remove estado and fecha fields from po_invoices and drop po_invoice_totales table

Revision ID: 20260211_remove_fields_and_totales_table
Revises: 20260211_create_po_invoice_taxes
Create Date: 2026-02-11 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260211_remove_fields_and_totales_table"
down_revision = "20260211_create_po_invoice_taxes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove estado and fecha fields from po_invoices and drop po_invoice_totales table."""
    
    # Drop po_invoice_totales table completely
    op.drop_table('po_invoice_totales')
    
    # Remove columns from po_invoices
    op.drop_column('po_invoices', 'estado')
    op.drop_column('po_invoices', 'fecha')


def downgrade() -> None:
    """Recreate estado and fecha fields in po_invoices and recreate po_invoice_totales table."""
    
    # Add columns back to po_invoices
    op.add_column('po_invoices', sa.Column('estado', sa.String(20), nullable=False, server_default='borrador'))
    op.add_column('po_invoices', sa.Column('fecha', sa.Date(), nullable=True))
    
    # Recreate po_invoice_totales table
    op.create_table(
        'po_invoice_totales',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('descripcion', sa.String(50), nullable=True),
        sa.Column('importe', sa.DECIMAL(15, 2), nullable=False),
        sa.Column('oportunidad_id', sa.Integer(), nullable=True),
        sa.Column('centro_costo_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['po_invoices.id']),
        sa.ForeignKeyConstraint(['oportunidad_id'], ['crm_oportunidades.id']),
        sa.ForeignKeyConstraint(['centro_costo_id'], ['centros_costo.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Recreate indexes for po_invoice_totales
    op.create_index('ix_po_invoice_totales_invoice_id', 'po_invoice_totales', ['invoice_id'])
    op.create_index('ix_po_invoice_totales_oportunidad_id', 'po_invoice_totales', ['oportunidad_id'])
    op.create_index('ix_po_invoice_totales_centro_costo_id', 'po_invoice_totales', ['centro_costo_id'])
    op.create_index('ix_po_invoice_totales_id', 'po_invoice_totales', ['id'])