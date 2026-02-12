"""add_importe_base_and_porcentaje_to_po_invoice_taxes

Revision ID: 7ebbe12eb398
Revises: 054f4b7e748c
Create Date: 2026-02-12 06:14:49.545625

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ebbe12eb398'
down_revision: Union[str, Sequence[str], None] = '054f4b7e748c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add importe_base and porcentaje columns to po_invoice_taxes
    op.add_column('po_invoice_taxes', sa.Column('importe_base', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('po_invoice_taxes', sa.Column('porcentaje', sa.Numeric(precision=5, scale=2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove importe_base and porcentaje columns from po_invoice_taxes
    op.drop_column('po_invoice_taxes', 'porcentaje')
    op.drop_column('po_invoice_taxes', 'importe_base')
