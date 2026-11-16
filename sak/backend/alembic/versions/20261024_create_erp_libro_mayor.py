"""create erp libro mayor

Revision ID: 20261024_erp_libro_mayor
Revises: 20261024_seed_icc
Create Date: 2026-10-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261024_erp_libro_mayor"
down_revision: Union[str, Sequence[str], None] = "20261024_seed_icc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_libro_mayor",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column("source_id", sa.BigInteger(), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("periodo_anio", sa.SmallInteger(), nullable=False),
        sa.Column("periodo_mes", sa.SmallInteger(), nullable=False),
        sa.Column("nivel", sa.String(length=10), nullable=False),
        sa.Column("cuenta_codigo", sa.Integer(), nullable=False),
        sa.Column("tipo_subcuenta", sa.String(length=50), nullable=True),
        sa.Column("nro_subcuenta", sa.String(length=50), nullable=True),
        sa.Column("centro_costo", sa.String(length=20), nullable=True),
        sa.Column("total_debe", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("total_haber", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("saldo_periodo", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("saldo_acumulado", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column(
            "recalculado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("saldo_anterior", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("fecha_periodo", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_erp_libro_mayor_source_id",
        "erp_libro_mayor",
        ["source_id"],
        unique=True,
    )
    op.create_index("ix_erp_libro_mayor_empresa_id", "erp_libro_mayor", ["empresa_id"])
    op.create_index("ix_erp_libro_mayor_periodo_anio", "erp_libro_mayor", ["periodo_anio"])
    op.create_index("ix_erp_libro_mayor_periodo_mes", "erp_libro_mayor", ["periodo_mes"])
    op.create_index("ix_erp_libro_mayor_nivel", "erp_libro_mayor", ["nivel"])
    op.create_index("ix_erp_libro_mayor_cuenta_codigo", "erp_libro_mayor", ["cuenta_codigo"])


def downgrade() -> None:
    op.drop_index("ix_erp_libro_mayor_cuenta_codigo", table_name="erp_libro_mayor")
    op.drop_index("ix_erp_libro_mayor_nivel", table_name="erp_libro_mayor")
    op.drop_index("ix_erp_libro_mayor_periodo_mes", table_name="erp_libro_mayor")
    op.drop_index("ix_erp_libro_mayor_periodo_anio", table_name="erp_libro_mayor")
    op.drop_index("ix_erp_libro_mayor_empresa_id", table_name="erp_libro_mayor")
    op.drop_index("ix_erp_libro_mayor_source_id", table_name="erp_libro_mayor")
    op.drop_table("erp_libro_mayor")
