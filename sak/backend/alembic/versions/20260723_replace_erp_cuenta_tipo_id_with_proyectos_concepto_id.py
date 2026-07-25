"""replace erp_cuenta_tipo_id with proyectos_concepto_id

Revision ID: 20260723_replace_erp_cuenta_tipo_id_with_proyectos_concepto_id
Revises: 20260722_add_erp_cuenta_tipo_id_to_erp_cuentas
Create Date: 2026-07-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260723_replace_erp_cuenta_tipo_id_with_proyectos_concepto_id"
down_revision: Union[str, Sequence[str], None] = "20260722_add_erp_cuenta_tipo_id_to_erp_cuentas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def _table_indexes(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def _table_foreign_keys(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {fk["name"] for fk in inspector.get_foreign_keys(table_name)}


def upgrade() -> None:
    columns = _table_columns("erp_cuentas")
    indexes = _table_indexes("erp_cuentas")
    fks = _table_foreign_keys("erp_cuentas")

    if "proyectos_concepto_id" not in columns:
        op.add_column("erp_cuentas", sa.Column("proyectos_concepto_id", sa.Integer(), nullable=True))

    if "erp_cuenta_tipo_id" in columns:
        op.execute(
            """
            UPDATE erp_cuentas
            SET proyectos_concepto_id = erp_cuenta_tipo_id
            WHERE proyectos_concepto_id IS NULL
              AND erp_cuenta_tipo_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM proyectos_conceptos WHERE id = erp_cuentas.erp_cuenta_tipo_id)
            """
        )

    if "ix_erp_cuentas_erp_cuenta_tipo_id" in indexes:
        op.drop_index("ix_erp_cuentas_erp_cuenta_tipo_id", table_name="erp_cuentas")

    if "fk_erp_cuentas_erp_cuenta_tipo_id" in fks:
        op.drop_constraint("fk_erp_cuentas_erp_cuenta_tipo_id", "erp_cuentas", type_="foreignkey")

    if "erp_cuenta_tipo_id" in columns:
        op.drop_column("erp_cuentas", "erp_cuenta_tipo_id")

    if "ix_erp_cuentas_proyectos_concepto_id" not in _table_indexes("erp_cuentas"):
        op.create_index("ix_erp_cuentas_proyectos_concepto_id", "erp_cuentas", ["proyectos_concepto_id"])

    if "fk_erp_cuentas_proyectos_concepto_id" not in _table_foreign_keys("erp_cuentas"):
        op.create_foreign_key(
            "fk_erp_cuentas_proyectos_concepto_id",
            "erp_cuentas",
            "proyectos_conceptos",
            ["proyectos_concepto_id"],
            ["id"],
        )

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "erp_cuenta_tipos" in inspector.get_table_names():
        op.drop_table("erp_cuenta_tipos")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("erp_cuentas")}
    indexes = {idx["name"] for idx in inspector.get_indexes("erp_cuentas")}
    fks = {fk["name"] for fk in inspector.get_foreign_keys("erp_cuentas")}

    if "fk_erp_cuentas_proyectos_concepto_id" in fks:
        op.drop_constraint("fk_erp_cuentas_proyectos_concepto_id", "erp_cuentas", type_="foreignkey")
    if "ix_erp_cuentas_proyectos_concepto_id" in indexes:
        op.drop_index("ix_erp_cuentas_proyectos_concepto_id", table_name="erp_cuentas")
    if "proyectos_concepto_id" in columns:
        op.drop_column("erp_cuentas", "proyectos_concepto_id")

    if "erp_cuenta_tipo_id" not in columns:
        op.add_column("erp_cuentas", sa.Column("erp_cuenta_tipo_id", sa.Integer(), nullable=True))

    if "erp_cuenta_tipos" not in inspector.get_table_names():
        op.create_table(
            "erp_cuenta_tipos",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("nombre", sa.String(length=200), nullable=False),
            sa.Column("descripcion", sa.String(length=500), nullable=True),
            sa.Column("cuenta", sa.String(length=50), nullable=False),
            sa.Column("es_impuesto", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
