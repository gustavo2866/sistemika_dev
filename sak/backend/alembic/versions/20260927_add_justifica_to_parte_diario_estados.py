"""add justifica to parte_diario_estados

Revision ID: 20260927_add_justifica_to_parte_diario_estados
Revises: 20260927_add_horas_to_tarja_nomina
Create Date: 2026-09-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260927_add_justifica_to_parte_diario_estados"
down_revision: Union[str, Sequence[str], None] = "20260927_add_horas_to_tarja_nomina"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "parte_diario_estados",
        sa.Column("justifica", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("parte_diario_estados", "justifica")