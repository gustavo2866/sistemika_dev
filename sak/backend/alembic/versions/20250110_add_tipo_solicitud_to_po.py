"""add tipo_solicitud to po tables

Revision ID: 20250110_add_tipo_solicitud_to_po
Revises: 20250110_add_centro_costo_and_quantities_to_po
Create Date: 2025-01-10 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20250110_add_tipo_solicitud_to_po'
down_revision: Union[str, Sequence[str], None] = '20250110_add_centro_costo_and_quantities_to_po'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add tipo_solicitud_id columns to PO tables."""
    
    # 1. Agregar tipo_solicitud_id a po_ordenes_compra (cabecera)
    op.add_column('po_ordenes_compra', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_po_ordenes_compra_tipo_solicitud', 'po_ordenes_compra', 'tipos_solicitud', ['tipo_solicitud_id'], ['id'])
    
    # 2. Agregar tipo_solicitud_id a po_facturas (cabecera)
    op.add_column('po_facturas', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_po_facturas_tipo_solicitud', 'po_facturas', 'tipos_solicitud', ['tipo_solicitud_id'], ['id'])


def downgrade() -> None:
    """Remove tipo_solicitud_id columns from PO tables."""
    
    # 1. Remover foreign keys
    op.drop_constraint('fk_po_facturas_tipo_solicitud', 'po_facturas', type_='foreignkey')
    op.drop_constraint('fk_po_ordenes_compra_tipo_solicitud', 'po_ordenes_compra', type_='foreignkey')
    
    # 2. Remover columnas tipo_solicitud_id
    op.drop_column('po_facturas', 'tipo_solicitud_id')
    op.drop_column('po_ordenes_compra', 'tipo_solicitud_id')