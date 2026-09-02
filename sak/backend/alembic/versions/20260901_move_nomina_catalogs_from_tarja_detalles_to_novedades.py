"""move nomina catalog fks from tarja_detalles to tarja_novedades

Revision ID: 20260901_move_nomina_catalogs_from_tarja_detalles_to_novedades
Revises: 20260829_update_tarja_novedades_unique_nomina
Create Date: 2026-09-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260901_move_nomina_catalogs_from_tarja_detalles_to_novedades"
down_revision: Union[str, Sequence[str], None] = "20260829_update_tarja_novedades_unique_nomina"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tarja_novedades",
        sa.Column("nomina_categoria_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tarja_novedades",
        sa.Column("nomina_tarea_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_tarja_novedades_nomina_categoria_id_nomina_categorias",
        "tarja_novedades",
        "nomina_categorias",
        ["nomina_categoria_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_tarja_novedades_nomina_tarea_id_nomina_tareas",
        "tarja_novedades",
        "nomina_tareas",
        ["nomina_tarea_id"],
        ["id"],
    )

    op.execute(
        sa.text(
            """
            UPDATE tarja_novedades tn
            SET nomina_categoria_id = td.nomina_categoria_id
            FROM tarja_detalles td
            WHERE td.tarja_id = tn.tarja_id
              AND td.idnomina = tn.nomina_id
              AND td.nomina_categoria_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE tarja_novedades tn
            SET nomina_tarea_id = td.nomina_tarea_id
            FROM tarja_detalles td
            WHERE td.tarja_id = tn.tarja_id
              AND td.idnomina = tn.nomina_id
              AND td.nomina_tarea_id IS NOT NULL
            """
        )
    )

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


def downgrade() -> None:
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

    op.execute(
        sa.text(
            """
            UPDATE tarja_detalles td
            SET nomina_categoria_id = tn.nomina_categoria_id
            FROM tarja_novedades tn
            WHERE td.tarja_id = tn.tarja_id
              AND td.idnomina = tn.nomina_id
              AND tn.nomina_categoria_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE tarja_detalles td
            SET nomina_tarea_id = tn.nomina_tarea_id
            FROM tarja_novedades tn
            WHERE td.tarja_id = tn.tarja_id
              AND td.idnomina = tn.nomina_id
              AND tn.nomina_tarea_id IS NOT NULL
            """
        )
    )

    op.drop_constraint(
        "fk_tarja_novedades_nomina_tarea_id_nomina_tareas",
        "tarja_novedades",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_tarja_novedades_nomina_categoria_id_nomina_categorias",
        "tarja_novedades",
        type_="foreignkey",
    )
    op.drop_column("tarja_novedades", "nomina_tarea_id")
    op.drop_column("tarja_novedades", "nomina_categoria_id")
