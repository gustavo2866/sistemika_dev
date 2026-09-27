"""create erp cash diario table

Revision ID: 20260922_create_erp_cash_diario
Revises: 20260922_add_categoria_to_erp_cash_map
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260922_create_erp_cash_diario"
down_revision: Union[str, Sequence[str], None] = "20260922_add_categoria_to_erp_cash_map"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_cash_diario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.BigInteger(), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("periodo_anio", sa.SmallInteger(), nullable=False),
        sa.Column("periodo_mes", sa.SmallInteger(), nullable=False),
        sa.Column("tipo_asiento", sa.String(length=255), nullable=True),
        sa.Column("nro_asiento", sa.String(length=255), nullable=True),
        sa.Column("nro_renglon", sa.String(length=255), nullable=True),
        sa.Column("cuenta_codigo", sa.Integer(), nullable=False),
        sa.Column("debe", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("haber", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo_subcuenta", sa.String(length=255), nullable=True),
        sa.Column("nro_subcuenta", sa.String(length=255), nullable=True),
        sa.Column("centro_costo", sa.String(length=255), nullable=True),
        sa.Column("cargado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("archivo_origen", sa.String(length=255), nullable=True),
        sa.Column("rubro", sa.String(length=255), nullable=True),
        sa.Column("cash", sa.String(length=10), nullable=True),
        sa.Column("cuenta_cash_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["cuenta_cash_id"], ["erp_cash_cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_erp_cash_diario_source_id", "erp_cash_diario", ["source_id"], unique=True)
    op.create_index("ix_erp_cash_diario_empresa_id", "erp_cash_diario", ["empresa_id"])
    op.create_index("ix_erp_cash_diario_fecha", "erp_cash_diario", ["fecha"])
    op.create_index("ix_erp_cash_diario_periodo_anio", "erp_cash_diario", ["periodo_anio"])
    op.create_index("ix_erp_cash_diario_periodo_mes", "erp_cash_diario", ["periodo_mes"])
    op.create_index("ix_erp_cash_diario_cuenta_codigo", "erp_cash_diario", ["cuenta_codigo"])
    op.create_index("ix_erp_cash_diario_rubro", "erp_cash_diario", ["rubro"])
    op.create_index("ix_erp_cash_diario_cash", "erp_cash_diario", ["cash"])
    op.create_index("ix_erp_cash_diario_cuenta_cash_id", "erp_cash_diario", ["cuenta_cash_id"])
    op.create_index(
        "idx_erp_cash_diario_empresa_periodo",
        "erp_cash_diario",
        ["empresa_id", "periodo_anio", "periodo_mes"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_erp_cash_diario_empresa_periodo", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_cuenta_cash_id", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_cash", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_rubro", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_cuenta_codigo", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_periodo_mes", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_periodo_anio", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_fecha", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_empresa_id", table_name="erp_cash_diario")
    op.drop_index("ix_erp_cash_diario_source_id", table_name="erp_cash_diario")
    op.drop_table("erp_cash_diario")
