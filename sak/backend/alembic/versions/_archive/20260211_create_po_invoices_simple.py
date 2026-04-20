"""Create PoInvoice system tables - simple version

Revision ID: 20260211_create_po_invoices_simple
Revises: 20260207_create_po_orders_and_status
Create Date: 2026-02-11 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260211_create_po_invoices_simple'
down_revision: Union[str, Sequence[str], None] = '20260207_create_po_orders_and_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create PoInvoice related tables."""
    
    # 1. Create po_invoice_status table first
    op.create_table(
        'po_invoice_status',
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
    
    # 2. Create po_invoices table
    op.create_table(
        'po_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('titulo', sa.String(length=50), nullable=False),
        sa.Column('numero', sa.String(length=50), nullable=False),
        sa.Column('fecha_emision', sa.String(), nullable=False),
        sa.Column('fecha_vencimiento', sa.String(), nullable=True),
        sa.Column('estado', sa.String(length=20), nullable=False, server_default='borrador'),
        sa.Column('observaciones', sa.String(), nullable=True),
        sa.Column('subtotal', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0'),
        sa.Column('total_impuestos', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0'),
        sa.Column('total', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0'),
        sa.Column('proveedor_id', sa.Integer(), nullable=False),
        sa.Column('usuario_responsable_id', sa.Integer(), nullable=False),
        sa.Column('invoice_status_id', sa.Integer(), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=True),
        sa.Column('fecha_estado', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['invoice_status_id'], ['po_invoice_status.id'], ),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id'], ),
        sa.ForeignKeyConstraint(['usuario_responsable_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 3. Create po_invoice_detalles table
    op.create_table(
        'po_invoice_detalles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('cantidad', sa.DECIMAL(precision=10, scale=3), nullable=False),
        sa.Column('precio_unitario', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('subtotal', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['po_invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 4. Create po_invoice_totales table
    op.create_table(
        'po_invoice_totales',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('descripcion', sa.String(length=50), nullable=True),
        sa.Column('importe', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['po_invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 5. Insert default invoice status records
    op.execute("""
        INSERT INTO po_invoice_status (nombre, descripcion, orden, activo, es_inicial, es_final) VALUES
        ('Borrador', 'Factura en borrador', 1, true, true, false),
        ('Emitida', 'Factura emitida', 2, true, false, false),
        ('Aprobada', 'Factura aprobada', 3, true, false, false),
        ('Rechazada', 'Factura rechazada', 4, true, false, true),
        ('Recibida', 'Factura recibida', 5, true, false, false),
        ('Cerrada', 'Factura cerrada', 6, true, false, true),
        ('Anulada', 'Factura anulada', 7, true, false, true);
    """)


def downgrade() -> None:
    """Drop PoInvoice related tables."""
    op.drop_table('po_invoice_totales')
    op.drop_table('po_invoice_detalles')
    op.drop_table('po_invoices')
    op.drop_table('po_invoice_status')