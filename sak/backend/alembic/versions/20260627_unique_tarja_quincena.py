"""Add unique constraint for quincenal tarjas

Revision ID: 20260627_unique_tarja_quincena
Revises: 20260627_add_registrado_estado_partes_diario
Create Date: 2026-06-27
"""
from typing import Union

from alembic import op

revision: str = "20260627_unique_tarja_quincena"
down_revision: Union[str, None] = "20260627_add_registrado_estado_partes_diario"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_tarjas_proyecto_contacto_rango",
        "tarjas",
        ["idproyecto", "contacto_id", "fechainicio", "fechafinal"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_tarjas_proyecto_contacto_rango",
        "tarjas",
        type_="unique",
    )
