"""create po_invoice_taxes table

Revision ID: 20260211_create_po_invoice_taxes
Revises: 20260211_add_fks_to_po_invoice_totales
Create Date: 2026-02-11 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import Column, DECIMAL


# revision identifiers, used by Alembic.
revision = "20260211_create_po_invoice_taxes"
down_revision = "20260211_add_fks_to_po_invoice_totales"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create po_invoice_taxes table."""
    
    # Create the po_invoice_taxes table
    op.create_table(
        'po_invoice_taxes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('descripcion', sa.String(50), nullable=True),
        sa.Column('importe', DECIMAL(15, 2), nullable=False),
        sa.Column('concepto_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['po_invoices.id'], name='fk_po_invoice_taxes_invoice_id'),
        sa.ForeignKeyConstraint(['concepto_id'], ['adm_conceptos.id'], name='fk_po_invoice_taxes_concepto_id'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_po_invoice_taxes_invoice_id', 'po_invoice_taxes', ['invoice_id'])
    op.create_index('ix_po_invoice_taxes_concepto_id', 'po_invoice_taxes', ['concepto_id'])
    op.create_index('ix_po_invoice_taxes_id', 'po_invoice_taxes', ['id'])


def downgrade() -> None:
    """Drop po_invoice_taxes table."""
    
    # Drop indexes
    op.drop_index('ix_po_invoice_taxes_id', table_name='po_invoice_taxes')
    op.drop_index('ix_po_invoice_taxes_concepto_id', table_name='po_invoice_taxes')
    op.drop_index('ix_po_invoice_taxes_invoice_id', table_name='po_invoice_taxes')
    
    # Drop table
    op.drop_table('po_invoice_taxes')