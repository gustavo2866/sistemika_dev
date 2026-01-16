"""add adm_concepto_id to proveedores

Revision ID: 20260112_add_adm_concepto_id_to_proveedores
Revises: 05b98d5d2ce2
Create Date: 2026-01-12 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260112_add_adm_concepto_id_to_proveedores"
down_revision = "05b98d5d2ce2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add adm_concepto_id column to proveedores table."""
    # Add the column
    op.add_column('proveedores', sa.Column('adm_concepto_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_proveedores_adm_concepto_id',
        'proveedores',
        'adm_conceptos',
        ['adm_concepto_id'],
        ['id']
    )
    
    # Add index
    op.create_index(
        'ix_proveedores_adm_concepto_id',
        'proveedores',
        ['adm_concepto_id']
    )


def downgrade() -> None:
    """Remove adm_concepto_id column from proveedores table."""
    # Drop index
    op.drop_index('ix_proveedores_adm_concepto_id', table_name='proveedores')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_proveedores_adm_concepto_id', 'proveedores', type_='foreignkey')
    
    # Drop column
    op.drop_column('proveedores', 'adm_concepto_id')