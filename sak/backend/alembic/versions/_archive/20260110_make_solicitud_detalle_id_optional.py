"""Make solicitud_detalle_id optional in po_orden_compra_detalles

Revision ID: 20260110_make_solicitud_detalle_id_optional
Revises: 20250110_fix_po_tables
Create Date: 2026-01-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260110_make_solicitud_detalle_id_optional'
down_revision = '20250110_fix_po_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make solicitud_detalle_id nullable in po_orden_compra_detalles
    op.alter_column('po_orden_compra_detalles', 'solicitud_detalle_id',
                   existing_type=sa.INTEGER(),
                   nullable=True)


def downgrade() -> None:
    # Make solicitud_detalle_id not nullable again
    # Note: This will fail if there are NULL values in the column
    op.alter_column('po_orden_compra_detalles', 'solicitud_detalle_id',
                   existing_type=sa.INTEGER(),
                   nullable=False)