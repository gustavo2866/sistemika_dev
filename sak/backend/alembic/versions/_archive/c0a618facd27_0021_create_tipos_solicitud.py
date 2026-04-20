"""0021_create_tipos_solicitud

Revision ID: c0a618facd27
Revises: 3b81b492a98d
Create Date: 2025-11-10 19:23:57.839144

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0a618facd27'
down_revision: Union[str, Sequence[str], None] = '3b81b492a98d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Crear tabla tipos_solicitud."""
    # Crear tabla tipos_solicitud
    op.create_table(
        'tipos_solicitud',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.Column('tipo_articulo_filter', sa.String(50), nullable=True),
        sa.Column('articulo_default_id', sa.Integer(), nullable=True),
        sa.Column('departamento_default_id', sa.Integer(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['articulo_default_id'], ['articulos.id']),
        sa.ForeignKeyConstraint(['departamento_default_id'], ['departamentos.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    # Crear índice en nombre
    op.create_index('ix_tipos_solicitud_nombre', 'tipos_solicitud', ['nombre'])


def downgrade() -> None:
    """Downgrade schema - Eliminar tabla tipos_solicitud."""
    op.drop_index('ix_tipos_solicitud_nombre')
    op.drop_table('tipos_solicitud')
