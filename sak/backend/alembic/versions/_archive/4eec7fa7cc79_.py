"""empty message

Revision ID: 4eec7fa7cc79
Revises: create_vw_kpis_proyectos, ffc0725d8ba1
Create Date: 2026-03-25 20:57:49.251369

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4eec7fa7cc79'
down_revision: Union[str, Sequence[str], None] = ('create_vw_kpis_proyectos', 'ffc0725d8ba1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
