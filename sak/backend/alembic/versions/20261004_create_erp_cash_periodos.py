"""create erp cash periodos table and seed 2026-2027

Revision ID: 20261004_create_erp_cash_periodos
Revises: 20261004_unique_erp_cash_proyectado
Create Date: 2026-10-04
"""

from datetime import UTC, date, datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261004_create_erp_cash_periodos"
down_revision: Union[str, Sequence[str], None] = "20261004_unique_erp_cash_proyectado"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _periodos_seed() -> list[dict[str, object]]:
    timestamp = datetime.now(UTC)
    periodos: list[dict[str, object]] = []
    for year in (2026, 2027):
        for month in range(1, 13):
            fecha_periodo = date(year, month, 1)
            cerrado = fecha_periodo <= date(2026, 8, 1)
            periodos.append(
                {
                    "created_at": timestamp,
                    "updated_at": timestamp,
                    "deleted_at": None,
                    "version": 1,
                    "fecha_periodo": fecha_periodo,
                    "estado": "CERRADO" if cerrado else "ABIERTO",
                    "ultima_sincronizacion": None,
                    "movimientos_count": 0,
                    "saldos_count": 0,
                    "cerrado_en": timestamp if cerrado else None,
                    "cerrado_por_id": None,
                }
            )
    return periodos


def upgrade() -> None:
    periodos = op.create_table(
        "erp_cash_periodos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("fecha_periodo", sa.Date(), nullable=False),
        sa.Column(
            "estado",
            sa.String(length=20),
            server_default=sa.text("'ABIERTO'"),
            nullable=False,
        ),
        sa.Column("ultima_sincronizacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("movimientos_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("saldos_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("cerrado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cerrado_por_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "estado IN ('ABIERTO', 'CERRADO')",
            name="ck_erp_cash_periodos_estado_valid",
        ),
        sa.CheckConstraint(
            "EXTRACT(DAY FROM fecha_periodo) = 1",
            name="ck_erp_cash_periodos_fecha_inicio_mes",
        ),
        sa.CheckConstraint(
            "movimientos_count >= 0",
            name="ck_erp_cash_periodos_movimientos_count_nonnegative",
        ),
        sa.CheckConstraint(
            "saldos_count >= 0",
            name="ck_erp_cash_periodos_saldos_count_nonnegative",
        ),
        sa.ForeignKeyConstraint(["cerrado_por_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_erp_cash_periodos_fecha_periodo",
        "erp_cash_periodos",
        ["fecha_periodo"],
        unique=False,
    )
    op.create_index(
        "ix_erp_cash_periodos_estado",
        "erp_cash_periodos",
        ["estado"],
        unique=False,
    )
    op.create_index(
        "ix_erp_cash_periodos_cerrado_por_id",
        "erp_cash_periodos",
        ["cerrado_por_id"],
        unique=False,
    )
    op.create_index(
        "uq_erp_cash_periodos_activo_fecha_periodo",
        "erp_cash_periodos",
        ["fecha_periodo"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.bulk_insert(periodos, _periodos_seed())


def downgrade() -> None:
    op.drop_index(
        "uq_erp_cash_periodos_activo_fecha_periodo",
        table_name="erp_cash_periodos",
    )
    op.drop_index("ix_erp_cash_periodos_cerrado_por_id", table_name="erp_cash_periodos")
    op.drop_index("ix_erp_cash_periodos_estado", table_name="erp_cash_periodos")
    op.drop_index("ix_erp_cash_periodos_fecha_periodo", table_name="erp_cash_periodos")
    op.drop_table("erp_cash_periodos")
