"""update tarja_novedades fields

Revision ID: 20260829_update_tarja_novedades_fields
Revises: 20260829_add_tarja_detalle_catalog_fk
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260829_update_tarja_novedades_fields"
down_revision: Union[str, Sequence[str], None] = "20260829_add_tarja_detalle_catalog_fk"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tarja_novedades", sa.Column("nomina_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_tarja_novedades_nomina_id_nominas",
        "tarja_novedades",
        "nominas",
        ["nomina_id"],
        ["id"],
    )

    op.alter_column(
        "tarja_novedades",
        "horas_enfermedad_justif",
        new_column_name="horas_justificadas",
    )

    op.add_column(
        "tarja_novedades",
        sa.Column(
            "presentismo_bool",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE tarja_novedades
            SET presentismo_bool = COALESCE(presentismo, 0) > 0
            """
        )
    )
    op.drop_column("tarja_novedades", "presentismo")
    op.alter_column("tarja_novedades", "presentismo_bool", new_column_name="presentismo")

    op.add_column(
        "tarja_novedades",
        sa.Column("adicional", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("tarja_novedades", "adicional")

    op.add_column(
        "tarja_novedades",
        sa.Column(
            "presentismo_importe",
            sa.DECIMAL(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE tarja_novedades
            SET presentismo_importe = CASE WHEN COALESCE(presentismo, false) THEN 1 ELSE 0 END
            """
        )
    )
    op.drop_column("tarja_novedades", "presentismo")
    op.alter_column("tarja_novedades", "presentismo_importe", new_column_name="presentismo")

    op.alter_column(
        "tarja_novedades",
        "horas_justificadas",
        new_column_name="horas_enfermedad_justif",
    )

    op.drop_constraint(
        "fk_tarja_novedades_nomina_id_nominas",
        "tarja_novedades",
        type_="foreignkey",
    )
    op.drop_column("tarja_novedades", "nomina_id")
