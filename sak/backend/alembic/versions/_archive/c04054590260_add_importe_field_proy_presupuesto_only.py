"""add_importe_field_proy_presupuesto_only

Revision ID: c04054590260
Revises: ffc0725d8ba1
Create Date: 2026-03-25 19:45:07.649749

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c04054590260'
down_revision: Union[str, Sequence[str], None] = '0e5f263a735e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add importe column to proy_presupuestos table
    op.add_column('proy_presupuestos', sa.Column('importe', sa.DECIMAL(precision=14, scale=2), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    # Drop importe column from proy_presupuestos table
    op.drop_column('proy_presupuestos', 'importe')
