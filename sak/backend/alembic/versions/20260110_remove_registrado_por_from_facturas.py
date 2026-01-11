"""Remove registrado_por_id from PoFactura for consistency

Revision ID: 20260110_remove_registrado_por_from_facturas
Revises: 20260110_remove_codigo_producto_from_detalles
Create Date: 2026-01-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260110_remove_registrado_por_from_facturas'
down_revision = '20260110_remove_codigo_producto_from_detalles'
branch_labels = None
depends_on = None


def upgrade():
    # Remove registrado_por_id from po_facturas
    op.drop_column('po_facturas', 'registrado_por_id')


def downgrade():
    # Restore registrado_por_id to po_facturas
    op.add_column('po_facturas', sa.Column('registrado_por_id', sa.INTEGER(), nullable=False, server_default='1'))
    # Restore foreign key constraint
    op.create_foreign_key('po_facturas_registrado_por_id_fkey', 'po_facturas', 'users', ['registrado_por_id'], ['id'])