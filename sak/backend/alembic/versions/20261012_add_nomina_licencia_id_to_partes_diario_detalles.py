"""add nomina_licencia_id to partes_diario_detalles

Revision ID: 20261014_nom_lic_fk
Revises: 20261013_nom_lic_fecha_nullable
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261014_nom_lic_fk"
down_revision: Union[str, Sequence[str], None] = "20261013_nom_lic_fecha_nullable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "partes_diario_detalles",
        sa.Column("nomina_licencia_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_partes_diario_detalles_nomina_licencia_id_nomina_licencias",
        "partes_diario_detalles",
        "nomina_licencias",
        ["nomina_licencia_id"],
        ["id"],
    )
    op.create_index(
        "ix_partes_diario_detalles_nomina_licencia_id",
        "partes_diario_detalles",
        ["nomina_licencia_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_partes_diario_detalles_nomina_licencia_id",
        table_name="partes_diario_detalles",
    )
    op.drop_constraint(
        "fk_partes_diario_detalles_nomina_licencia_id_nomina_licencias",
        "partes_diario_detalles",
        type_="foreignkey",
    )
    op.drop_column("partes_diario_detalles", "nomina_licencia_id")
