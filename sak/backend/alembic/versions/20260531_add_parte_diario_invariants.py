"""add parte diario uniqueness invariants

Revision ID: 20260531_add_parte_diario_invariants
Revises: 20260530_rename_pendiente_to_borrador_partes_diario
Create Date: 2026-05-31

"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260531_add_parte_diario_invariants"
down_revision: Union[str, None] = "20260530_rename_pendiente_to_borrador_partes_diario"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_partes_diario_proyecto_fecha",
        "partes_diario",
        ["idproyecto", "fecha"],
    )
    op.create_unique_constraint(
        "uq_partes_diario_detalles_parte_nomina",
        "partes_diario_detalles",
        ["parte_diario_id", "idnomina"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_partes_diario_detalles_parte_nomina",
        "partes_diario_detalles",
        type_="unique",
    )
    op.drop_constraint(
        "uq_partes_diario_proyecto_fecha",
        "partes_diario",
        type_="unique",
    )
