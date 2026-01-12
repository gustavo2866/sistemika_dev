"""merge_heads_after_articulo_updates

Revision ID: f8298a7b7cf2
Revises: 20260111_add_adm_concepto_to_tipos_articulo, b433f4a6e37b
Create Date: 2026-01-11 18:17:30.566900

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8298a7b7cf2'
down_revision: Union[str, Sequence[str], None] = ('20260111_add_adm_concepto_to_tipos_articulo', 'b433f4a6e37b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
