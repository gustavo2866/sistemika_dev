"""0020_create_departamentos

Revision ID: 3b81b492a98d
Revises: 0005_create_parte_diario
Create Date: 2025-11-10 19:23:24.119061

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b81b492a98d'
down_revision: Union[str, Sequence[str], None] = '0005_create_parte_diario'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Crear tabla departamentos."""
    # Crear tabla departamentos
    op.create_table(
        'departamentos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    # Crear índice en nombre
    op.create_index('ix_departamentos_nombre', 'departamentos', ['nombre'])


def downgrade() -> None:
    """Downgrade schema - Eliminar tabla departamentos."""
    op.drop_index('ix_departamentos_nombre')
    op.drop_table('departamentos')
