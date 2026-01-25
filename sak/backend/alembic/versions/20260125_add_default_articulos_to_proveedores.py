"""add default_articulos_id to proveedores

Revision ID: 20260125_add_default_articulos_to_proveedores
Revises: 20260124_add_activo_generico_to_articulos
Create Date: 2026-01-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260125_add_default_articulos_to_proveedores'
down_revision = '20260124_add_activo_generico_to_articulos'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add default_articulos_id column to proveedores table"""
    
    # Add the new column
    op.add_column('proveedores', sa.Column('default_articulos_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_proveedores_default_articulos_id',
        'proveedores', 
        'articulos',
        ['default_articulos_id'], 
        ['id'],
        ondelete='SET NULL'
    )
    
    # Add index for performance
    op.create_index('ix_proveedores_default_articulos_id', 'proveedores', ['default_articulos_id'])


def downgrade() -> None:
    """Remove default_articulos_id column from proveedores table"""
    
    # Drop index
    op.drop_index('ix_proveedores_default_articulos_id', table_name='proveedores')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_proveedores_default_articulos_id', 'proveedores', type_='foreignkey')
    
    # Drop column
    op.drop_column('proveedores', 'default_articulos_id')