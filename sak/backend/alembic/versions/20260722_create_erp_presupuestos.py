"""create erp presupuestos table

Revision ID: 20260722_create_erp_presupuestos
Revises: 20260720_create_erp_rubros_cuentas
Create Date: 2026-07-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260722_create_erp_presupuestos"
down_revision: Union[str, Sequence[str], None] = "20260720_create_erp_rubros_cuentas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_presupuestos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("proyecto_id", sa.Integer(), nullable=False),
        sa.Column("erp_cuenta_id", sa.Integer(), nullable=False),
        sa.Column("egreso", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("ingres", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("obreros_cantidad", sa.DECIMAL(precision=10, scale=2), nullable=False, server_default="0"),
        sa.Column("obreros_costo", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"]),
        sa.ForeignKeyConstraint(["erp_cuenta_id"], ["erp_cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_erp_presupuestos_fecha", "erp_presupuestos", ["fecha"])
    op.create_index("ix_erp_presupuestos_proyecto_id", "erp_presupuestos", ["proyecto_id"])
    op.create_index("ix_erp_presupuestos_erp_cuenta_id", "erp_presupuestos", ["erp_cuenta_id"])


def downgrade() -> None:
    op.drop_index("ix_erp_presupuestos_erp_cuenta_id", table_name="erp_presupuestos")
    op.drop_index("ix_erp_presupuestos_proyecto_id", table_name="erp_presupuestos")
    op.drop_index("ix_erp_presupuestos_fecha", table_name="erp_presupuestos")
    op.drop_table("erp_presupuestos")
