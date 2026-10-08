"""create erp cash proyectado table

Revision ID: 20261004_create_erp_cash_proyectado
Revises: 20261004_reseed_erp_cash_saldos_202512
Create Date: 2026-10-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261004_create_erp_cash_proyectado"
down_revision: Union[str, Sequence[str], None] = "20261004_reseed_erp_cash_saldos_202512"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_cash_proyectado",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("cuenta_cash_id", sa.Integer(), nullable=False),
        sa.Column("fecha_periodo", sa.Date(), nullable=False),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("importe", sa.Numeric(18, 2), server_default="0", nullable=False),
        sa.Column("observacion", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["cuenta_cash_id"], ["erp_cash_cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "tipo IN ('PROYECCION', 'PRESUPUESTO', 'COMPROMETIDO', 'AJUSTE')",
            name="ck_erp_cash_proyectado_tipo_valid",
        ),
        sa.CheckConstraint(
            "EXTRACT(DAY FROM fecha_periodo) = 1",
            name="ck_erp_cash_proyectado_fecha_inicio_mes",
        ),
    )

    op.create_index(
        "ix_erp_cash_proyectado_cuenta_cash_id",
        "erp_cash_proyectado",
        ["cuenta_cash_id"],
        unique=False,
    )
    op.create_index(
        "ix_erp_cash_proyectado_fecha_periodo",
        "erp_cash_proyectado",
        ["fecha_periodo"],
        unique=False,
    )
    op.create_index(
        "ix_erp_cash_proyectado_tipo",
        "erp_cash_proyectado",
        ["tipo"],
        unique=False,
    )
    op.create_index(
        "idx_erp_cash_proyectado_cuenta_periodo",
        "erp_cash_proyectado",
        ["cuenta_cash_id", "fecha_periodo"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_erp_cash_proyectado_cuenta_periodo", table_name="erp_cash_proyectado")
    op.drop_index("ix_erp_cash_proyectado_tipo", table_name="erp_cash_proyectado")
    op.drop_index("ix_erp_cash_proyectado_fecha_periodo", table_name="erp_cash_proyectado")
    op.drop_index("ix_erp_cash_proyectado_cuenta_cash_id", table_name="erp_cash_proyectado")
    op.drop_table("erp_cash_proyectado")