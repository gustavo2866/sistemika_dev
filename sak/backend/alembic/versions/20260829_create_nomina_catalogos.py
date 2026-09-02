"""update nomina maestro to catalog fks

Revision ID: 20260829_update_nomina_catalogs_fk
Revises: 20260725_add_real_fields_to_erp_presupuestos
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260829_update_nomina_catalogs_fk"
down_revision: Union[str, Sequence[str], None] = "20260725_add_real_fields_to_erp_presupuestos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_catalog_table(table_name: str) -> None:
    op.create_table(
        table_name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.CHAR(length=5), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo", name=f"uq_{table_name}_codigo"),
    )


def _seed_catalog_table(table_name: str, rows: list[tuple[str, str]]) -> None:
    for codigo, descripcion in rows:
        stmt = sa.text(
            f"""
            INSERT INTO {table_name} (codigo, descripcion, activa, created_at, updated_at, version)
            SELECT :codigo, :descripcion, :activa, NOW(), NOW(), 1
            WHERE NOT EXISTS (
                SELECT 1 FROM {table_name} WHERE codigo = :codigo
            )
            """
        ).bindparams(codigo=codigo, descripcion=descripcion, activa=True)
        op.execute(stmt)


def upgrade() -> None:
    _create_catalog_table("nomina_categorias")
    _create_catalog_table("nomina_tareas")

    _seed_catalog_table(
        "nomina_categorias",
        [
            ("OF", "Oficial"),
            ("AY", "Ayudante"),
            ("MOF", "Medio oficial"),
        ],
    )
    _seed_catalog_table(
        "nomina_tareas",
        [
            ("A", "Albañileria"),
            ("E", "Estructura"),
            ("H", "Herreria"),
            ("S", "Sanitario"),
        ],
    )

    op.add_column(
        "nominas",
        sa.Column("nomina_categoria_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "nominas",
        sa.Column("nomina_tarea_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_nominas_nomina_categoria_id_nomina_categorias",
        "nominas",
        "nomina_categorias",
        ["nomina_categoria_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_nominas_nomina_tarea_id_nomina_tareas",
        "nominas",
        "nomina_tareas",
        ["nomina_tarea_id"],
        ["id"],
    )

    op.execute(sa.text("UPDATE nominas SET nomina_categoria_id = (SELECT id FROM nomina_categorias WHERE codigo = 'OF') WHERE categoria = 'oficial'"))
    op.execute(sa.text("UPDATE nominas SET nomina_categoria_id = (SELECT id FROM nomina_categorias WHERE codigo = 'MOF') WHERE categoria = 'medio_oficial'"))
    op.execute(sa.text("UPDATE nominas SET nomina_categoria_id = (SELECT id FROM nomina_categorias WHERE codigo = 'AY') WHERE categoria = 'ayudante'"))

    op.drop_column("nominas", "categoria")


def downgrade() -> None:
    op.add_column("nominas", sa.Column("categoria", sa.String(length=32), nullable=True))

    op.execute(sa.text("UPDATE nominas SET categoria = 'oficial' WHERE nomina_categoria_id = (SELECT id FROM nomina_categorias WHERE codigo = 'OF')"))
    op.execute(sa.text("UPDATE nominas SET categoria = 'medio_oficial' WHERE nomina_categoria_id = (SELECT id FROM nomina_categorias WHERE codigo = 'MOF')"))
    op.execute(sa.text("UPDATE nominas SET categoria = 'ayudante' WHERE nomina_categoria_id = (SELECT id FROM nomina_categorias WHERE codigo = 'AY')"))

    op.drop_constraint("fk_nominas_nomina_tarea_id_nomina_tareas", "nominas", type_="foreignkey")
    op.drop_constraint("fk_nominas_nomina_categoria_id_nomina_categorias", "nominas", type_="foreignkey")
    op.drop_column("nominas", "nomina_tarea_id")
    op.drop_column("nominas", "nomina_categoria_id")

    op.drop_table("nomina_tareas")
    op.drop_table("nomina_categorias")
