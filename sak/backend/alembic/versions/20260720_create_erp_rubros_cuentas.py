"""create erp rubros and cuentas tables

Revision ID: 20260720_create_erp_rubros_cuentas
Revises: 20260705_partes_diario_unique_active_softdelete
Create Date: 2026-07-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260720_create_erp_rubros_cuentas"
down_revision: Union[str, Sequence[str], None] = "20260705_partes_diario_unique_active_softdelete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create erp_rubros table
    op.create_table(
        "erp_rubros",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_erp_rubros_nombre"),
    )
    op.create_index("ix_erp_rubros_nombre", "erp_rubros", ["nombre"])
    op.create_index("ix_erp_rubros_activo", "erp_rubros", ["activo"])

    # Create erp_cuentas table
    op.create_table(
        "erp_cuentas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("rubro_id", sa.Integer(), nullable=False),
        sa.Column("nro_cuenta", sa.Integer(), nullable=False),
        sa.Column("cod_cuenta", sa.String(length=50), nullable=False),
        sa.Column("descripcion", sa.String(length=500), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["rubro_id"], ["erp_rubros.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cod_cuenta", name="uq_erp_cuentas_cod_cuenta"),
    )
    op.create_index("ix_erp_cuentas_rubro_id", "erp_cuentas", ["rubro_id"])
    op.create_index("ix_erp_cuentas_nro_cuenta", "erp_cuentas", ["nro_cuenta"])
    op.create_index("ix_erp_cuentas_cod_cuenta", "erp_cuentas", ["cod_cuenta"])
    op.create_index("ix_erp_cuentas_descripcion", "erp_cuentas", ["descripcion"])
    op.create_index("ix_erp_cuentas_activo", "erp_cuentas", ["activo"])


def downgrade() -> None:
    op.drop_index("ix_erp_cuentas_activo", table_name="erp_cuentas")
    op.drop_index("ix_erp_cuentas_descripcion", table_name="erp_cuentas")
    op.drop_index("ix_erp_cuentas_cod_cuenta", table_name="erp_cuentas")
    op.drop_index("ix_erp_cuentas_nro_cuenta", table_name="erp_cuentas")
    op.drop_index("ix_erp_cuentas_rubro_id", table_name="erp_cuentas")
    op.drop_table("erp_cuentas")

    op.drop_index("ix_erp_rubros_activo", table_name="erp_rubros")
    op.drop_index("ix_erp_rubros_nombre", table_name="erp_rubros")
    op.drop_table("erp_rubros")
