"""fix po tables columns

Revision ID: 20250110_fix_po_tables
Revises: b60f63877ff2
Create Date: 2025-01-10 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20250110_fix_po_tables'
down_revision: Union[str, Sequence[str], None] = 'b60f63877ff2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ensure all PO table columns exist with correct definitions."""
    
    # Verificar y agregar columnas que puedan faltar
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Verificar columnas en po_ordenes_compra
    oc_columns = [col['name'] for col in inspector.get_columns('po_ordenes_compra')]
    
    if 'centro_costo_id' not in oc_columns:
        op.add_column('po_ordenes_compra', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
        
    if 'tipo_solicitud_id' not in oc_columns:
        op.add_column('po_ordenes_compra', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    
    # Verificar columnas en po_orden_compra_detalles
    ocd_columns = [col['name'] for col in inspector.get_columns('po_orden_compra_detalles')]
    
    if 'cantidad_recibida' not in ocd_columns:
        op.add_column('po_orden_compra_detalles', sa.Column('cantidad_recibida', sa.DECIMAL(precision=10, scale=3), server_default='0', nullable=False))
        
    if 'cantidad_facturada' not in ocd_columns:
        op.add_column('po_orden_compra_detalles', sa.Column('cantidad_facturada', sa.DECIMAL(precision=10, scale=3), server_default='0', nullable=False))
        
    if 'centro_costo_id' not in ocd_columns:
        op.add_column('po_orden_compra_detalles', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    
    # Verificar columnas en po_facturas
    pf_columns = [col['name'] for col in inspector.get_columns('po_facturas')]
    
    if 'centro_costo_id' not in pf_columns:
        op.add_column('po_facturas', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
        
    if 'tipo_solicitud_id' not in pf_columns:
        op.add_column('po_facturas', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    
    # Verificar columnas en po_factura_detalles
    pfd_columns = [col['name'] for col in inspector.get_columns('po_factura_detalles')]
    
    if 'centro_costo_id' not in pfd_columns:
        op.add_column('po_factura_detalles', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    
    # Verificar y crear foreign keys si no existen
    existing_fks = inspector.get_foreign_keys('po_ordenes_compra')
    existing_fk_names = [fk['name'] for fk in existing_fks]
    
    if 'fk_po_ordenes_compra_centro_costo' not in existing_fk_names:
        try:
            op.create_foreign_key('fk_po_ordenes_compra_centro_costo', 'po_ordenes_compra', 'centros_costo', ['centro_costo_id'], ['id'])
        except:
            pass  # La FK puede ya existir con otro nombre
            
    if 'fk_po_ordenes_compra_tipo_solicitud' not in existing_fk_names:
        try:
            op.create_foreign_key('fk_po_ordenes_compra_tipo_solicitud', 'po_ordenes_compra', 'tipos_solicitud', ['tipo_solicitud_id'], ['id'])
        except:
            pass


def downgrade() -> None:
    """Remove columns if needed."""
    pass  # No implementamos downgrade para evitar pérdida de datos