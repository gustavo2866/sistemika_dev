"""reseed erp cash saldos to 2025-12

Revision ID: 20261004_reseed_erp_cash_saldos_202512
Revises: 20261004_create_erp_cash_saldos
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


revision: str = "20261004_reseed_erp_cash_saldos_202512"
down_revision: Union[str, Sequence[str], None] = "20261004_create_erp_cash_saldos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")

WRONG_SEED_PERIODO_ANIO = 2024
TARGET_SEED_PERIODO_ANIO = 2025
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


def _fetch_seed_rows(periodo_anio: int) -> list[dict[str, Any]]:
    with psycopg.connect(
        **_get_source_connection_kwargs(),
        row_factory=dict_row,
    ) as source_conn, source_conn.cursor() as source_cur:
        source_cur.execute(SEED_SELECT_QUERY, (periodo_anio, SEED_PERIODO_MES))
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


def _count_rows(bind: sa.engine.Connection, periodo_anio: int) -> int:
    return int(
        bind.execute(
            sa.text(
                """
                SELECT count(*)
                FROM erp_cash_saldos
                WHERE periodo_anio = :periodo_anio
                  AND periodo_mes = :periodo_mes
                """
            ).bindparams(periodo_anio=periodo_anio, periodo_mes=SEED_PERIODO_MES)
        ).scalar_one()
    )


def _delete_period_rows(bind: sa.engine.Connection, periodo_anio: int) -> None:
    bind.execute(
        sa.text(
            """
            DELETE FROM erp_cash_saldos
            WHERE periodo_anio = :periodo_anio
              AND periodo_mes = :periodo_mes
            """
        ).bindparams(periodo_anio=periodo_anio, periodo_mes=SEED_PERIODO_MES)
    )


def upgrade() -> None:
    bind = op.get_bind()
    wrong_count = _count_rows(bind, WRONG_SEED_PERIODO_ANIO)
    target_count = _count_rows(bind, TARGET_SEED_PERIODO_ANIO)

    if wrong_count > 0:
        _delete_period_rows(bind, WRONG_SEED_PERIODO_ANIO)

    if target_count == 0:
        payloads = _build_seed_payloads(_fetch_seed_rows(TARGET_SEED_PERIODO_ANIO))
        if payloads:
            bind.execute(INSERT_SEED_QUERY, payloads)


def downgrade() -> None:
    bind = op.get_bind()
    wrong_count = _count_rows(bind, WRONG_SEED_PERIODO_ANIO)
    target_count = _count_rows(bind, TARGET_SEED_PERIODO_ANIO)

    if target_count > 0:
        _delete_period_rows(bind, TARGET_SEED_PERIODO_ANIO)

    if wrong_count == 0:
        payloads = _build_seed_payloads(_fetch_seed_rows(WRONG_SEED_PERIODO_ANIO))
        if payloads:
            bind.execute(INSERT_SEED_QUERY, payloads)