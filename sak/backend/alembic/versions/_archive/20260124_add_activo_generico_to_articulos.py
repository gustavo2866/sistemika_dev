"""add_activo_and_generico_to_articulos

Revision ID: 20260124_add_activo_generico_to_articulos
Revises: 20260124_add_tipo_compra_and_default_fields
Create Date: 2026-01-24 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260124_add_activo_generico_to_articulos'
down_revision = '20260124_add_tipo_compra_and_default_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar campo activo (default False)
    op.add_column('articulos', sa.Column('activo', sa.Boolean(), nullable=False, server_default='false'))
    
    # Agregar campo generico (default True)
    op.add_column('articulos', sa.Column('generico', sa.Boolean(), nullable=False, server_default='true'))
    
    # Crear índices para mejorar performance
    op.create_index('idx_articulos_activo', 'articulos', ['activo'])
    op.create_index('idx_articulos_generico', 'articulos', ['generico'])


def downgrade():
    # Eliminar índices
    op.drop_index('idx_articulos_generico', 'articulos')
    op.drop_index('idx_articulos_activo', 'articulos')
    
    # Eliminar columnas
    op.drop_column('articulos', 'generico')
    op.drop_column('articulos', 'activo')