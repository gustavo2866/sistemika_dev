"""create_proy_presupuestos_table

Revision ID: 7720674349e1
Revises: 20260324_112400_add_responsable_id_fk_to_proyecto
Create Date: 2026-03-25 09:26:03.463965

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7720674349e1'
down_revision: Union[str, Sequence[str], None] = '20260324_112400_add_responsable_id_fk_to_proyecto'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('proy_presupuestos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('proyecto_id', sa.Integer(), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('mo_propia', sa.DECIMAL(14, 2), nullable=False, server_default='0'),
        sa.Column('mo_terceros', sa.DECIMAL(14, 2), nullable=False, server_default='0'),
        sa.Column('materiales', sa.DECIMAL(14, 2), nullable=False, server_default='0'),
        sa.Column('horas', sa.DECIMAL(10, 2), nullable=False, server_default='0'),
        sa.Column('metros', sa.DECIMAL(10, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('proy_presupuestos')
