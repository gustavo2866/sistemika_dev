"""drop activo from tarja_nomina

Revision ID: 20260905_drop_activo_from_tarja_nomina
Revises: 20260904_create_tarja_nomina_table
Create Date: 2026-09-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260905_drop_activo_from_tarja_nomina"
down_revision: Union[str, Sequence[str], None] = "20260904_create_tarja_nomina_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("tarja_nomina", "activo")


def downgrade() -> None:
    op.add_column(
        "tarja_nomina",
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
