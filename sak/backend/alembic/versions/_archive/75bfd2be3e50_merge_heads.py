"""merge_heads

Revision ID: 75bfd2be3e50
Revises: 2025011201, remove_codigo_tipos_prop
Create Date: 2025-11-29 15:34:24.908163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75bfd2be3e50'
down_revision: Union[str, Sequence[str], None] = ('2025011201', 'remove_codigo_tipos_prop')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
