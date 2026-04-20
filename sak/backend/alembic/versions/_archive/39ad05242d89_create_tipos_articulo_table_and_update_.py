"""Create tipos_articulo table and update articulos

Revision ID: 39ad05242d89
Revises: 7e815a521765
Create Date: 2026-01-09 07:41:35.647978

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39ad05242d89'
down_revision: Union[str, Sequence[str], None] = '7e815a521765'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla tipos_articulo
    op.create_table('tipos_articulo',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('descripcion', sa.String(length=500), nullable=True),
        sa.Column('codigo_contable', sa.String(length=50), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, default=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices
    op.create_index('ix_tipos_articulo_nombre', 'tipos_articulo', ['nombre'], unique=True)
    op.create_index('ix_tipos_articulo_codigo_contable', 'tipos_articulo', ['codigo_contable'], unique=False)
    
    # Agregar nueva columna tipo_articulo_id a tabla articulos
    op.add_column('articulos', sa.Column('tipo_articulo_id', sa.Integer(), nullable=True))
    
    # Crear foreign key constraint
    op.create_foreign_key(
        'fk_articulos_tipo_articulo_id', 
        'articulos', 
        'tipos_articulo', 
        ['tipo_articulo_id'], 
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar foreign key constraint
    op.drop_constraint('fk_articulos_tipo_articulo_id', 'articulos', type_='foreignkey')
    
    # Eliminar columna tipo_articulo_id
    op.drop_column('articulos', 'tipo_articulo_id')
    
    # Eliminar índices
    op.drop_index('ix_tipos_articulo_codigo_contable', table_name='tipos_articulo')
    op.drop_index('ix_tipos_articulo_nombre', table_name='tipos_articulo')
    
    # Eliminar tabla tipos_articulo
    op.drop_table('tipos_articulo')
