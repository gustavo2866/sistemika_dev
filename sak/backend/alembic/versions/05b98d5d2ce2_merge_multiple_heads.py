"""merge_multiple_heads

Revision ID: 05b98d5d2ce2
Revises: 103a99b6faf9, 20260112_add_po_factura_totales
Create Date: 2026-01-12 15:25:10.694447

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05b98d5d2ce2'
down_revision: Union[str, Sequence[str], None] = ('103a99b6faf9', '20260112_add_po_factura_totales')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
