"""Remove codigo_producto from PoOrdenCompraDetalle

Revision ID: 20260110_remove_codigo_producto_from_detalles
Revises: 20260110_update_po_models_cleanup
Create Date: 2026-01-10 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260110_remove_codigo_producto_from_detalles'
down_revision = '20260110_update_po_models_cleanup'
branch_labels = None
depends_on = None


def upgrade():
    # Remove codigo_producto from po_orden_compra_detalles
    op.drop_column('po_orden_compra_detalles', 'codigo_producto')


def downgrade():
    # Restore codigo_producto to po_orden_compra_detalles
    op.add_column('po_orden_compra_detalles', sa.Column('codigo_producto', sa.VARCHAR(length=50), nullable=True))