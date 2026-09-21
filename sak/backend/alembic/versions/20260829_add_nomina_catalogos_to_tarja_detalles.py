"""add nomina catalog fks to tarja_detalles

Revision ID: 20260829_add_tarja_detalle_catalog_fk
Revises: 20260829_update_nomina_catalogs_fk
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260829_add_tarja_detalle_catalog_fk"
down_revision: Union[str, Sequence[str], None] = "20260829_update_nomina_catalogs_fk"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tarja_detalles",
        sa.Column("nomina_categoria_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tarja_detalles",
        sa.Column("nomina_tarea_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_tarja_detalles_nomina_categoria_id_nomina_categorias",
        "tarja_detalles",
        "nomina_categorias",
        ["nomina_categoria_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_tarja_detalles_nomina_tarea_id_nomina_tareas",
        "tarja_detalles",
        "nomina_tareas",
        ["nomina_tarea_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tarja_detalles_nomina_tarea_id_nomina_tareas",
        "tarja_detalles",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_tarja_detalles_nomina_categoria_id_nomina_categorias",
        "tarja_detalles",
        type_="foreignkey",
    )

    op.drop_column("tarja_detalles", "nomina_tarea_id")
    op.drop_column("tarja_detalles", "nomina_categoria_id")
