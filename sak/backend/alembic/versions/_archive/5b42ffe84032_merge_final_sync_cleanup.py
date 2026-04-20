"""merge final sync cleanup

Revision ID: 5b42ffe84032
Revises: sync_cleanup_safe
Create Date: 2026-01-11 18:41:25.133936

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b42ffe84032'
down_revision: Union[str, Sequence[str], None] = 'sync_cleanup_safe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
