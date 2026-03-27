"""add_importe_to_proyecto_avance

Revision ID: 0e5f263a735e
Revises: 7720674349e1
Create Date: 2026-03-25 17:08:00.514941

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e5f263a735e'
down_revision: Union[str, Sequence[str], None] = '7720674349e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('proyecto_avance', sa.Column('importe', sa.DECIMAL(14, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('proyecto_avance', 'importe')
