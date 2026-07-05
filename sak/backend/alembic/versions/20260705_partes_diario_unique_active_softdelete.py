"""partes_diario unique only for active rows

Revision ID: 20260705_partes_diario_unique_active_softdelete
Revises: 20260703_create_proyectos_budget
Create Date: 2026-07-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260705_partes_diario_unique_active_softdelete"
down_revision: Union[str, Sequence[str], None] = "20260703_create_proyectos_budget"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_partes_diario_proyecto_fecha_contacto", "partes_diario", type_="unique")
    op.create_index(
        "uq_partes_diario_proyecto_fecha_contacto_activo",
        "partes_diario",
        ["idproyecto", "fecha", "contacto_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_partes_diario_proyecto_fecha_contacto_activo", table_name="partes_diario")
    op.create_unique_constraint(
        "uq_partes_diario_proyecto_fecha_contacto",
        "partes_diario",
        ["idproyecto", "fecha", "contacto_id"],
    )
