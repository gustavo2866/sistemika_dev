"""add premio to tarjas

Revision ID: 20260920_add_premio_to_tarjas
Revises: 20260904_create_tarja_nomina_table
Create Date: 2026-09-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260920_add_premio_to_tarjas"
down_revision: Union[str, Sequence[str], None] = "20260904_create_tarja_nomina_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tarjas",
        sa.Column("premio", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("tarjas", "premio")