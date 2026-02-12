"""add tipo_comprobante_id and dias_vencimiento to proveedores

Revision ID: 20260211_add_proveedor_tipo_comprobante_dias
Revises: 20260211_add_missing_invoice_fields
Create Date: 2026-02-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260211_add_proveedor_tipo_comprobante_dias"
down_revision = "20260211_add_missing_invoice_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add tipo_comprobante_id and dias_vencimiento columns to proveedores table."""
    
    # Add tipo_comprobante_id column
    op.add_column('proveedores', sa.Column('tipo_comprobante_id', sa.Integer(), nullable=True))
    
    # Add dias_vencimiento column
    op.add_column('proveedores', sa.Column('dias_vencimiento', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for tipo_comprobante_id
    op.create_foreign_key(
        'fk_proveedores_tipo_comprobante_id',
        'proveedores',
        'tipos_comprobante',
        ['tipo_comprobante_id'],
        ['id']
    )
    
    # Add index for tipo_comprobante_id
    op.create_index(
        'ix_proveedores_tipo_comprobante_id',
        'proveedores',
        ['tipo_comprobante_id']
    )


def downgrade() -> None:
    """Remove tipo_comprobante_id and dias_vencimiento columns from proveedores table."""
    
    # Drop index
    op.drop_index('ix_proveedores_tipo_comprobante_id', table_name='proveedores')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_proveedores_tipo_comprobante_id', 'proveedores', type_='foreignkey')
    
    # Drop columns
    op.drop_column('proveedores', 'tipo_comprobante_id')
    op.drop_column('proveedores', 'dias_vencimiento')