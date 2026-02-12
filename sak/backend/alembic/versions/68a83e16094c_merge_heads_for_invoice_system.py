"""merge heads for invoice system

Revision ID: 68a83e16094c
Revises: 20260211_create_po_invoices_simple, 851a0d1bd70b
Create Date: 2026-02-11 02:16:23.842904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68a83e16094c'
down_revision: Union[str, Sequence[str], None] = ('20260211_create_po_invoices_simple', '851a0d1bd70b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
