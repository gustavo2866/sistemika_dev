"""fix jornada sunday to zero

Revision ID: 20261016_fix_jornada_sunday_zero
Revises: 20261015_add_jornada_to_partes_diario
Create Date: 2026-10-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261016_fix_jornada_sunday_zero"
down_revision: Union[str, Sequence[str], None] = "20261015_add_jornada_to_partes_diario"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE partes_diario
            SET jornada = CASE
                WHEN EXTRACT(ISODOW FROM fecha) = 7 THEN 0
                WHEN EXTRACT(ISODOW FROM fecha) = 6 THEN 6
                ELSE 9
            END
            WHERE jornada IS NULL OR jornada = 0 OR jornada = 9 OR jornada = 6
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE partes_diario
            SET jornada = CASE
                WHEN EXTRACT(ISODOW FROM fecha) = 6 THEN 6
                ELSE 9
            END
            WHERE EXTRACT(ISODOW FROM fecha) BETWEEN 1 AND 7
            """
        )
    )
