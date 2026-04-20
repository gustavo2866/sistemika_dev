"""merge_po_updates_with_main

Revision ID: b60f63877ff2
Revises: 20250110_add_tipo_solicitud_to_po, 4fd206b59569
Create Date: 2026-01-10 07:57:12.864575

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b60f63877ff2'
down_revision: Union[str, Sequence[str], None] = ('20250110_add_tipo_solicitud_to_po', '4fd206b59569')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
