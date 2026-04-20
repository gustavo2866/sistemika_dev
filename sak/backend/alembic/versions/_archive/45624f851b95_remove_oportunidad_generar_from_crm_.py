"""remove_oportunidad_generar_from_crm_mensajes

Revision ID: 45624f851b95
Revises: ae80ff90f949
Create Date: 2026-01-03 08:04:51.937188

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '45624f851b95'
down_revision: Union[str, Sequence[str], None] = 'ae80ff90f949'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('crm_mensajes', 'oportunidad_generar')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('crm_mensajes', sa.Column('oportunidad_generar', sa.Boolean(), nullable=False, server_default='false'))
