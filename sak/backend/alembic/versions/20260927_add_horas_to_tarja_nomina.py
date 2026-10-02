"""add horas trabajadas y liquidadas to tarja_nomina

Revision ID: 20260927_add_horas_to_tarja_nomina
Revises: 20260927_change_tarja_premio_to_boolean
Create Date: 2026-09-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260927_add_horas_to_tarja_nomina"
down_revision: Union[str, Sequence[str], None] = "20260927_change_tarja_premio_to_boolean"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tarja_nomina",
        sa.Column("horas_trabajadas", sa.DECIMAL(8, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "tarja_nomina",
        sa.Column("horas_liquidadas", sa.DECIMAL(8, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("tarja_nomina", "horas_liquidadas")
    op.drop_column("tarja_nomina", "horas_trabajadas")