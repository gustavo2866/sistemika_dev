"""add oportunidad_id and centro_costo_id to po_invoice_totales

Revision ID: 20260211_add_fks_to_po_invoice_totales
Revises: 20260211_add_es_impuesto_to_adm_conceptos
Create Date: 2026-02-11 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260211_add_fks_to_po_invoice_totales"
down_revision = "20260211_add_es_impuesto_to_adm_conceptos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add oportunidad_id and centro_costo_id columns to po_invoice_totales table."""
    
    # Add oportunidad_id column
    op.add_column('po_invoice_totales', sa.Column('oportunidad_id', sa.Integer(), nullable=True))
    
    # Add centro_costo_id column
    op.add_column('po_invoice_totales', sa.Column('centro_costo_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for oportunidad_id
    op.create_foreign_key(
        'fk_po_invoice_totales_oportunidad_id',
        'po_invoice_totales',
        'crm_oportunidades',
        ['oportunidad_id'],
        ['id']
    )
    
    # Add foreign key constraint for centro_costo_id
    op.create_foreign_key(
        'fk_po_invoice_totales_centro_costo_id',
        'po_invoice_totales',
        'centros_costo',
        ['centro_costo_id'],
        ['id']
    )
    
    # Add indexes for the foreign keys
    op.create_index(
        'ix_po_invoice_totales_oportunidad_id',
        'po_invoice_totales',
        ['oportunidad_id']
    )
    
    op.create_index(
        'ix_po_invoice_totales_centro_costo_id',
        'po_invoice_totales',
        ['centro_costo_id']
    )


def downgrade() -> None:
    """Remove oportunidad_id and centro_costo_id columns from po_invoice_totales table."""
    
    # Drop indexes
    op.drop_index('ix_po_invoice_totales_centro_costo_id', table_name='po_invoice_totales')
    op.drop_index('ix_po_invoice_totales_oportunidad_id', table_name='po_invoice_totales')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_po_invoice_totales_centro_costo_id', 'po_invoice_totales', type_='foreignkey')
    op.drop_constraint('fk_po_invoice_totales_oportunidad_id', 'po_invoice_totales', type_='foreignkey')
    
    # Drop columns
    op.drop_column('po_invoice_totales', 'centro_costo_id')
    op.drop_column('po_invoice_totales', 'oportunidad_id')