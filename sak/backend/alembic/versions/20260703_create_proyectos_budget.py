"""create proyectos budget table

Revision ID: 20260703_create_proyectos_budget
Revises: 20260703_create_proyectos_conceptos
Create Date: 2026-07-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260703_create_proyectos_budget"
down_revision: Union[str, Sequence[str], None] = "20260703_create_proyectos_conceptos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "proyectos_budget",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("proyecto_id", sa.Integer(), nullable=False),
        sa.Column("proyectos_concepto_id", sa.Integer(), nullable=False),
        sa.Column("proyectos_macrorubro_id", sa.Integer(), nullable=False),
        sa.Column("importe", sa.DECIMAL(14, 2), nullable=False, server_default="0"),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("horas", sa.DECIMAL(10, 2), nullable=False, server_default="0"),
        sa.Column("empleados", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valor_hora", sa.DECIMAL(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"]),
        sa.ForeignKeyConstraint(["proyectos_concepto_id"], ["proyectos_conceptos.id"]),
        sa.ForeignKeyConstraint(["proyectos_macrorubro_id"], ["proyectos_macrorubros.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_proyectos_budget_fecha", "proyectos_budget", ["fecha"])
    op.create_index("ix_proyectos_budget_proyecto_id", "proyectos_budget", ["proyecto_id"])
    op.create_index(
        "ix_proyectos_budget_proyectos_concepto_id",
        "proyectos_budget",
        ["proyectos_concepto_id"],
    )
    op.create_index(
        "ix_proyectos_budget_proyectos_macrorubro_id",
        "proyectos_budget",
        ["proyectos_macrorubro_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_proyectos_budget_proyectos_macrorubro_id", table_name="proyectos_budget")
    op.drop_index("ix_proyectos_budget_proyectos_concepto_id", table_name="proyectos_budget")
    op.drop_index("ix_proyectos_budget_proyecto_id", table_name="proyectos_budget")
    op.drop_index("ix_proyectos_budget_fecha", table_name="proyectos_budget")
    op.drop_table("proyectos_budget")
