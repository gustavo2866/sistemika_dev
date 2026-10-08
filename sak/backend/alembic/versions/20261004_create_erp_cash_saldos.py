"""create erp cash saldos table and seed 2025-12

Revision ID: 20261004_create_erp_cash_saldos
Revises: 20261003_allow_fondo_erp_cash_cuentas
Create Date: 2026-10-04
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Sequence, Union

import psycopg
import sqlalchemy as sa
from alembic import op
from dotenv import load_dotenv
from psycopg.rows import dict_row


revision: str = "20261004_create_erp_cash_saldos"
down_revision: Union[str, Sequence[str], None] = "20261003_allow_fondo_erp_cash_cuentas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")

SEED_PERIODO_ANIO = 2025
SEED_PERIODO_MES = 12

SEED_SELECT_QUERY = """
SELECT
    id,
    empresa_id,
    periodo_anio,
    periodo_mes,
    nivel,
    cuenta_codigo,
    tipo_subcuenta,
    nro_subcuenta,
    centro_costo,
    total_debe,
    total_haber,
    saldo_periodo,
    saldo_acumulado,
    recalculado_en,
    saldo_anterior,
    fecha_periodo
FROM public.libro_mayor
WHERE periodo_anio = %s
  AND periodo_mes = %s
ORDER BY id
"""

INSERT_SEED_QUERY = sa.text(
    """
    INSERT INTO erp_cash_saldos (
        created_at,
        updated_at,
        deleted_at,
        version,
        source_id,
        empresa_id,
        periodo_anio,
        periodo_mes,
        nivel,
        cuenta_codigo,
        tipo_subcuenta,
        nro_subcuenta,
        centro_costo,
        total_debe,
        total_haber,
        saldo_periodo,
        saldo_acumulado,
        recalculado_en,
        saldo_anterior,
        fecha_periodo
    ) VALUES (
        :created_at,
        :updated_at,
        :deleted_at,
        :version,
        :source_id,
        :empresa_id,
        :periodo_anio,
        :periodo_mes,
        :nivel,
        :cuenta_codigo,
        :tipo_subcuenta,
        :nro_subcuenta,
        :centro_costo,
        :total_debe,
        :total_haber,
        :saldo_periodo,
        :saldo_acumulado,
        :recalculado_en,
        :saldo_anterior,
        :fecha_periodo
    )
    """
)


def _normalize_url(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://")


def _get_source_connection_kwargs() -> dict[str, str]:
    host = os.getenv("ERP_SOURCE_DB_HOST")
    dbname = os.getenv("ERP_SOURCE_DB_NAME")
    user = os.getenv("ERP_SOURCE_DB_USER")
    password = os.getenv("NEON_DB_PASSWORD") or os.getenv("ERP_SOURCE_DB_PASSWORD")

    if host and dbname and user and password:
        return {
            "host": host,
            "dbname": dbname,
            "user": user,
            "password": password,
            "sslmode": os.getenv("ERP_SOURCE_SSLMODE", "require"),
        }

    url = os.getenv("ERP_SOURCE_DATABASE_URL") or os.getenv("EXTERNAL_NEON_DATABASE_URL")
    if not url:
        raise RuntimeError(
            "Faltan credenciales del ERP origen para seed de erp_cash_saldos."
        )
    return {"dsn": _normalize_url(url)}


def _fetch_seed_rows() -> list[dict[str, Any]]:
    with psycopg.connect(
        **_get_source_connection_kwargs(),
        row_factory=dict_row,
    ) as source_conn, source_conn.cursor() as source_cur:
        source_cur.execute(SEED_SELECT_QUERY, (SEED_PERIODO_ANIO, SEED_PERIODO_MES))
        return list(source_cur.fetchall())


def _build_seed_payloads(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    now = datetime.now(UTC)
    payloads: list[dict[str, Any]] = []
    for row in rows:
        payloads.append(
            {
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
                "version": 1,
                "source_id": row["id"],
                "empresa_id": row["empresa_id"],
                "periodo_anio": row["periodo_anio"],
                "periodo_mes": row["periodo_mes"],
                "nivel": row["nivel"],
                "cuenta_codigo": row["cuenta_codigo"],
                "tipo_subcuenta": row["tipo_subcuenta"],
                "nro_subcuenta": row["nro_subcuenta"],
                "centro_costo": row["centro_costo"],
                "total_debe": row["total_debe"],
                "total_haber": row["total_haber"],
                "saldo_periodo": row["saldo_periodo"],
                "saldo_acumulado": row["saldo_acumulado"],
                "recalculado_en": row["recalculado_en"],
                "saldo_anterior": row["saldo_anterior"],
                "fecha_periodo": row["fecha_periodo"],
            }
        )
    return payloads


def upgrade() -> None:
    op.create_table(
        "erp_cash_saldos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.BigInteger(), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("periodo_anio", sa.SmallInteger(), nullable=False),
        sa.Column("periodo_mes", sa.SmallInteger(), nullable=False),
        sa.Column("nivel", sa.String(length=10), nullable=False),
        sa.Column("cuenta_codigo", sa.Integer(), nullable=False),
        sa.Column("tipo_subcuenta", sa.String(length=50), nullable=True),
        sa.Column("nro_subcuenta", sa.String(length=50), nullable=True),
        sa.Column("centro_costo", sa.String(length=20), nullable=True),
        sa.Column("total_debe", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("total_haber", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("saldo_periodo", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("saldo_acumulado", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("recalculado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("saldo_anterior", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("fecha_periodo", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_erp_cash_saldos_source_id", "erp_cash_saldos", ["source_id"], unique=True)
    op.create_index("ix_erp_cash_saldos_nivel", "erp_cash_saldos", ["nivel"], unique=False)
    op.create_index("idx_erp_cash_saldos_cuenta", "erp_cash_saldos", ["cuenta_codigo"], unique=False)
    op.create_index(
        "idx_erp_cash_saldos_empresa_periodo",
        "erp_cash_saldos",
        ["empresa_id", "periodo_anio", "periodo_mes"],
        unique=False,
    )

    bind = op.get_bind()
    payloads = _build_seed_payloads(_fetch_seed_rows())
    if payloads:
        bind.execute(INSERT_SEED_QUERY, payloads)


def downgrade() -> None:
    op.drop_index("idx_erp_cash_saldos_empresa_periodo", table_name="erp_cash_saldos")
    op.drop_index("idx_erp_cash_saldos_cuenta", table_name="erp_cash_saldos")
    op.drop_index("ix_erp_cash_saldos_nivel", table_name="erp_cash_saldos")
    op.drop_index("ix_erp_cash_saldos_source_id", table_name="erp_cash_saldos")
    op.drop_table("erp_cash_saldos")