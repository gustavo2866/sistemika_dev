"""add presentismo_autorizado to tarja_nomina

Revision ID: 20260927_add_presentismo_autorizado_to_tarja_nomina
Revises: 20260927_add_justifica_to_parte_diario_estados
Create Date: 2026-09-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260927_add_presentismo_autorizado_to_tarja_nomina"
down_revision: Union[str, Sequence[str], None] = "20260927_add_justifica_to_parte_diario_estados"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tarja_nomina",
        sa.Column("presentismo_autorizado", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tarja_nomina", "presentismo_autorizado")