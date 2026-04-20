"""add fecha and fecha_estado to po_ordenes_compra

Revision ID: 20260115_add_fecha_and_fecha_estado_to_po_ordenes_compra
Revises: 20260112_add_adm_concepto_id_to_proveedores
Create Date: 2026-01-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260115_add_fecha_and_fecha_estado_to_po_ordenes_compra'
down_revision: Union[str, Sequence[str], Sequence[str], None] = '20260112_add_adm_concepto_id_to_proveedores'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add fecha and fecha_estado columns to po_ordenes_compra table."""
    
    # Agregar campo fecha (tipo DATE)
    op.add_column('po_ordenes_compra', sa.Column('fecha', sa.Date(), nullable=True))
    
    # Agregar campo fecha_estado (tipo TIMESTAMP)
    op.add_column('po_ordenes_compra', sa.Column('fecha_estado', sa.TIMESTAMP(), nullable=True))


def downgrade() -> None:
    """Remove fecha and fecha_estado columns from po_ordenes_compra table."""
    
    # Remover campos en orden inverso
    op.drop_column('po_ordenes_compra', 'fecha_estado')
    op.drop_column('po_ordenes_compra', 'fecha')