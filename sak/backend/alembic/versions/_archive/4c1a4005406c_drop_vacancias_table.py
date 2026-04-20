"""drop_vacancias_table

Revision ID: 4c1a4005406c
Revises: 267b3a8cae5b
Create Date: 2026-02-21 07:24:29.030337

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c1a4005406c'
down_revision: Union[str, Sequence[str], None] = '267b3a8cae5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Drop vacancias table."""
    # Drop the index first
    op.drop_index('ix_vacancias_propiedad_id', table_name='vacancias')
    # Drop the table
    op.drop_table('vacancias')


def downgrade() -> None:
    """Downgrade schema - Recreate vacancias table."""
    # Recreate the table (based on the original creation migration)
    op.create_table('vacancias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('propiedad_id', sa.Integer(), nullable=False),
        sa.Column('ciclo_activo', sa.Boolean(), nullable=False),
        sa.Column('fecha_recibida', sa.Date(), nullable=True),
        sa.Column('comentario_recibida', sa.String(), nullable=True),
        sa.Column('fecha_en_reparacion', sa.Date(), nullable=True),
        sa.Column('comentario_en_reparacion', sa.String(), nullable=True),
        sa.Column('fecha_disponible', sa.Date(), nullable=True),
        sa.Column('comentario_disponible', sa.String(), nullable=True),
        sa.Column('fecha_alquilada', sa.Date(), nullable=True),
        sa.Column('comentario_alquilada', sa.String(), nullable=True),
        sa.Column('fecha_retirada', sa.Date(), nullable=True),
        sa.Column('comentario_retirada', sa.String(), nullable=True),
        sa.Column('dias_reparacion', sa.Integer(), nullable=True),
        sa.Column('dias_disponible', sa.Integer(), nullable=True),
        sa.Column('dias_totales', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['propiedad_id'], ['propiedades.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    # Recreate the index
    op.create_index('ix_vacancias_propiedad_id', 'vacancias', ['propiedad_id'], unique=False)
