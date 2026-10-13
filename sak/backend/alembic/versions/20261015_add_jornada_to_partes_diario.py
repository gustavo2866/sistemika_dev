"""add jornada to partes_diario

Revision ID: 20261015_add_jornada_to_partes_diario
Revises: 20261014_nom_lic_fk
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261015_add_jornada_to_partes_diario"
down_revision: Union[str, Sequence[str], None] = "20261014_nom_lic_fk"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "partes_diario",
        sa.Column(
            "jornada",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default=sa.text("9"),
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE partes_diario
            SET jornada = CASE
                WHEN EXTRACT(ISODOW FROM fecha) = 7 THEN 0
                WHEN EXTRACT(ISODOW FROM fecha) = 6 THEN 6
                ELSE 9
            END
            """
        )
    )
    op.alter_column(
        "partes_diario",
        "jornada",
        existing_type=sa.Numeric(precision=5, scale=2),
        server_default=sa.text("9"),
    )


def downgrade() -> None:
    op.drop_column("partes_diario", "jornada")
