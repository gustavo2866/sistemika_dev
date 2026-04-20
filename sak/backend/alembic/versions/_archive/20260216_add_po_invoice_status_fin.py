"""Add PoInvoiceStatusFin table and FK to PoInvoice

Revision ID: 20260216_add_po_invoice_status_fin
Revises: 20260211_add_missing_invoice_fields
Create Date: 2026-02-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260216_add_po_invoice_status_fin'
down_revision: Union[str, Sequence[str], None] = '7545126e8317'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add PoInvoiceStatusFin table and FK to PoInvoice."""
    
    # 1. Create po_invoice_status_fin table (identical to po_invoice_status)
    op.create_table(
        'po_invoice_status_fin',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc'::text, now())")),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc'::text, now())")),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('nombre', sa.String(length=50), nullable=False),
        sa.Column('descripcion', sa.String(length=200), nullable=True),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('es_inicial', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('es_final', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    
    # 2. Add index for nombre field
    op.create_index('ix_po_invoice_status_fin_nombre', 'po_invoice_status_fin', ['nombre'])
    
    # 3. Add FK column to po_invoices table
    op.add_column('po_invoices', sa.Column('invoice_status_fin_id', sa.Integer(), nullable=True))
    
    # 4. Create foreign key constraint
    op.create_foreign_key(
        'fk_po_invoices_invoice_status_fin', 
        'po_invoices', 
        'po_invoice_status_fin', 
        ['invoice_status_fin_id'], 
        ['id']
    )
    
    # 5. Create index on the FK column
    op.create_index('ix_po_invoices_invoice_status_fin_id', 'po_invoices', ['invoice_status_fin_id'])
    
    # 6. Insert initial data for financial states
    op.execute("""
        INSERT INTO po_invoice_status_fin (nombre, descripcion, orden, activo, es_inicial, es_final) VALUES
        ('Pendiente', 'Factura pendiente de procesamiento financiero', 1, true, true, false),
        ('En Proceso', 'Factura en proceso de revisión financiera', 2, true, false, false),
        ('Aprobada Financieramente', 'Factura aprobada por el departamento financiero', 3, true, false, false),
        ('Pagada', 'Factura pagada completamente', 4, true, false, true),
        ('Rechazada Financieramente', 'Factura rechazada por el departamento financiero', 5, true, false, true);
    """)


def downgrade() -> None:
    """Remove PoInvoiceStatusFin table and FK from PoInvoice."""
    
    # 1. Drop FK constraint and index from po_invoices
    op.drop_index('ix_po_invoices_invoice_status_fin_id', 'po_invoices')
    op.drop_constraint('fk_po_invoices_invoice_status_fin', 'po_invoices', type_='foreignkey')
    op.drop_column('po_invoices', 'invoice_status_fin_id')
    
    # 2. Drop index and table
    op.drop_index('ix_po_invoice_status_fin_nombre', 'po_invoice_status_fin')
    op.drop_table('po_invoice_status_fin')