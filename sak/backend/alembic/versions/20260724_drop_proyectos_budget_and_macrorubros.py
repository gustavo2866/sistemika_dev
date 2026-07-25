"""drop proyectos_budget and proyectos_macrorubros tables

Revision ID: 20260724_drop_proyectos_budget_and_macrorubros
Revises: 20260723_replace_erp_cuenta_tipo_id_with_proyectos_concepto_id
Create Date: 2026-07-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260724_drop_proyectos_budget_and_macrorubros"
down_revision: Union[str, Sequence[str], None] = "20260723_replace_erp_cuenta_tipo_id_with_proyectos_concepto_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "proyectos_budget" in existing_tables:
        op.drop_table("proyectos_budget")

    if "proyectos_macrorubros" in existing_tables:
        op.drop_table("proyectos_macrorubros")


def downgrade() -> None:
    op.create_table(
        "proyectos_macrorubros",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proyectos_macrorubros_nombre", "proyectos_macrorubros", ["nombre"])
    op.create_index("ix_proyectos_macrorubros_activo", "proyectos_macrorubros", ["activo"])

    op.create_table(
        "proyectos_budget",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("proyecto_id", sa.Integer(), nullable=False),
        sa.Column("proyectos_concepto_id", sa.Integer(), nullable=False),
        sa.Column("proyectos_macrorubro_id", sa.Integer(), nullable=False),
        sa.Column("importe", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("horas", sa.DECIMAL(precision=10, scale=2), nullable=False, server_default="0"),
        sa.Column("empleados", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valor_hora", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"]),
        sa.ForeignKeyConstraint(["proyectos_concepto_id"], ["proyectos_conceptos.id"]),
        sa.ForeignKeyConstraint(["proyectos_macrorubro_id"], ["proyectos_macrorubros.id"]),
    )
    op.create_index("ix_proyectos_budget_fecha", "proyectos_budget", ["fecha"])
    op.create_index("ix_proyectos_budget_proyecto_id", "proyectos_budget", ["proyecto_id"])
    op.create_index("ix_proyectos_budget_proyectos_concepto_id", "proyectos_budget", ["proyectos_concepto_id"])
    op.create_index("ix_proyectos_budget_proyectos_macrorubro_id", "proyectos_budget", ["proyectos_macrorubro_id"])
