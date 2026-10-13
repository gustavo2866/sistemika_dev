"""make nomina licencia fecha hasta nullable

Revision ID: 20261013_nom_lic_fecha_nullable
Revises: 20261012_add_licencia_to_parte_diario_estados
Create Date: 2026-10-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261013_nom_lic_fecha_nullable"
down_revision: Union[str, Sequence[str], None] = (
    "20261012_add_licencia_to_parte_diario_estados"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "nomina_licencias",
        "fecha_hasta",
        existing_type=sa.Date(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE nomina_licencias "
        "SET fecha_hasta = fecha_desde "
        "WHERE fecha_hasta IS NULL"
    )
    op.alter_column(
        "nomina_licencias",
        "fecha_hasta",
        existing_type=sa.Date(),
        nullable=False,
    )
