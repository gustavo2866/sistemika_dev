"""add licencia to parte_diario_estados

Revision ID: 20261012_add_licencia_to_parte_diario_estados
Revises: 20261011_create_nomina_licencias
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261012_add_licencia_to_parte_diario_estados"
down_revision: Union[str, Sequence[str], None] = "20261011_create_nomina_licencias"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "parte_diario_estados",
        sa.Column("licencia", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.execute(
        sa.text(
            """
            UPDATE parte_diario_estados
            SET licencia = true
            WHERE abreviatura IN ('ACC', 'ENF', 'VAC')
            """
        )
    )


def downgrade() -> None:
    op.drop_column("parte_diario_estados", "licencia")
