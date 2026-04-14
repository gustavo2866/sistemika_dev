"""merge_heads_before_propiedad_propietario_campos

Revision ID: 4d781a7c99cd
Revises: 20260411_contratos, 4eec7fa7cc79
Create Date: 2026-04-12 09:02:18.766336

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d781a7c99cd'
down_revision: Union[str, Sequence[str], None] = ('20260411_contratos', '4eec7fa7cc79')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
