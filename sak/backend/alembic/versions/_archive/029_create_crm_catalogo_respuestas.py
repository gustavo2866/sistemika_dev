"""create_crm_catalogo_respuestas_only

Revision ID: 029_create_crm_catalogo_respuestas
Revises: 45624f851b95
Create Date: 2026-01-05 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '029_crm_catresp'
down_revision: Union[str, Sequence[str], None] = '45624f851b95'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create crm_catalogo_respuestas table."""
    op.create_table('crm_catalogo_respuestas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('texto', sa.Text(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop crm_catalogo_respuestas table."""
    op.drop_table('crm_catalogo_respuestas')