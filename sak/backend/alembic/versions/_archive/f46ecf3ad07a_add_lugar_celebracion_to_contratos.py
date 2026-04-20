"""add_lugar_celebracion_to_contratos

Revision ID: f46ecf3ad07a
Revises: cd2c2491ff7c
Create Date: 2026-04-12 09:19:01.170948

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f46ecf3ad07a'
down_revision: Union[str, Sequence[str], None] = 'cd2c2491ff7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE contratos ADD COLUMN IF NOT EXISTS lugar_celebracion VARCHAR(200)")


def downgrade() -> None:
    op.execute("ALTER TABLE contratos DROP COLUMN IF EXISTS lugar_celebracion")
