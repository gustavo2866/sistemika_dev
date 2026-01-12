"""Add adm_concepto_id to tipos_articulo and drop codigo_contable.

Revision ID: 20260111_add_adm_concepto_to_tipos_articulo
Revises: 1bd2425fecd5
Create Date: 2026-01-11 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260111_add_adm_concepto_to_tipos_articulo"
down_revision = "1bd2425fecd5"
branch_labels = None
depends_on = None


DEFAULT_CONCEPTO_NOMBRE = "Concepto default"
DEFAULT_CONCEPTO_CUENTA = "DEFAULT"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO adm_conceptos (nombre, descripcion, cuenta)
        SELECT '{DEFAULT_CONCEPTO_NOMBRE}', 'Concepto por defecto para tipos de articulo', '{DEFAULT_CONCEPTO_CUENTA}'
        WHERE NOT EXISTS (
            SELECT 1 FROM adm_conceptos WHERE cuenta = '{DEFAULT_CONCEPTO_CUENTA}'
        )
        """
    )

    with op.batch_alter_table("tipos_articulo") as batch:
        batch.add_column(sa.Column("adm_concepto_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_tipos_articulo_adm_concepto_id",
            "adm_conceptos",
            ["adm_concepto_id"],
            ["id"],
        )

    op.execute(
        f"""
        UPDATE tipos_articulo
        SET adm_concepto_id = (
            SELECT id FROM adm_conceptos
            WHERE cuenta = '{DEFAULT_CONCEPTO_CUENTA}'
            ORDER BY id
            LIMIT 1
        )
        WHERE adm_concepto_id IS NULL
        """
    )

    with op.batch_alter_table("tipos_articulo") as batch:
        batch.alter_column("adm_concepto_id", nullable=False)
        batch.drop_index("ix_tipos_articulo_codigo_contable")
        batch.drop_column("codigo_contable")


def downgrade() -> None:
    with op.batch_alter_table("tipos_articulo") as batch:
        batch.add_column(sa.Column("codigo_contable", sa.String(length=50), nullable=True))
        batch.create_index("ix_tipos_articulo_codigo_contable", ["codigo_contable"], unique=False)
        batch.drop_constraint("fk_tipos_articulo_adm_concepto_id", type_="foreignkey")
        batch.drop_column("adm_concepto_id")
