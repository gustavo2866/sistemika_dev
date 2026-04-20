"""Add missing base columns to PO tables

Revision ID: 60278347d3ea
Revises: 58ebe380bb01
Create Date: 2026-01-07 16:20:13.706714

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60278347d3ea'
down_revision: Union[str, Sequence[str], None] = '58ebe380bb01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar columnas faltantes a todas las tablas PO
    po_tables = [
        'po_solicitudes',
        'po_solicitud_detalles', 
        'po_ordenes_compra',
        'po_orden_compra_detalles',
        'po_facturas',
        'po_factura_detalles',
        'po_factura_impuestos'
    ]
    
    for table_name in po_tables:
        # Agregar deleted_at
        op.add_column(table_name, sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        # Agregar version
        op.add_column(table_name, sa.Column('version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar columnas agregadas
    po_tables = [
        'po_solicitudes',
        'po_solicitud_detalles', 
        'po_ordenes_compra',
        'po_orden_compra_detalles',
        'po_facturas',
        'po_factura_detalles',
        'po_factura_impuestos'
    ]
    
    for table_name in po_tables:
        op.drop_column(table_name, 'version')
        op.drop_column(table_name, 'deleted_at')
