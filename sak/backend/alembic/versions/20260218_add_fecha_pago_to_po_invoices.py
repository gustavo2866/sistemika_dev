"""Add fecha_pago field to po_invoices

Revision ID: 20260218_add_fecha_pago_to_po_invoices
Revises: 20260216_add_po_invoice_status_fin
Create Date: 2026-02-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260218_add_fecha_pago_to_po_invoices'
down_revision: Union[str, Sequence[str], None] = '20260216_add_po_invoice_status_fin'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add fecha_pago field to po_invoices table."""
    
    # Add fecha_pago column to po_invoices
    op.add_column('po_invoices', sa.Column('fecha_pago', sa.Date(), nullable=True))


def downgrade() -> None:
    """Remove fecha_pago field from po_invoices table."""
    
    # Drop fecha_pago column from po_invoices
    op.drop_column('po_invoices', 'fecha_pago')