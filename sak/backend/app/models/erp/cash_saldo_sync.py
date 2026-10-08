from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.models.erp.libro_diario_sync import get_source_connection_kwargs


CASH_EMPRESA_IDS = frozenset({1, 2, 5})


SOURCE_SALDOS_QUERY = """
    SELECT
        lm.id AS source_id,
        lm.empresa_id,
        lm.periodo_anio,
        lm.periodo_mes,
        lm.nivel,
        lm.cuenta_codigo,
        lm.tipo_subcuenta,
        lm.nro_subcuenta,
        lm.centro_costo,
        lm.total_debe,
        lm.total_haber,
        lm.saldo_periodo,
        lm.saldo_acumulado,
        lm.recalculado_en,
        lm.saldo_anterior,
        lm.fecha_periodo
    FROM public.libro_mayor lm
    WHERE lm.periodo_anio = %s
      AND lm.periodo_mes = %s
      AND lm.nivel = 'subcuenta'
      AND lm.cuenta_codigo = ANY(%s)
      AND lm.empresa_id IN (1, 2, 5)
    ORDER BY lm.id
"""


SALDO_FIELDS = (
    "source_id",
    "empresa_id",
    "periodo_anio",
    "periodo_mes",
    "nivel",
    "cuenta_codigo",
    "tipo_subcuenta",
    "nro_subcuenta",
    "centro_costo",
    "total_debe",
    "total_haber",
    "saldo_periodo",
    "saldo_acumulado",
    "recalculado_en",
    "saldo_anterior",
    "fecha_periodo",
)


def _row_value(row: Any, field: str) -> Any:
    if isinstance(row, Mapping):
        return row.get(field)
    return getattr(row, field, None)


def build_cash_saldo_payloads(
    source_rows: Iterable[Any],
    fondo_account_codes: set[int],
) -> list[dict[str, Any]]:
    """Normaliza saldos subcuenta pertenecientes a cuentas contables Fondo."""
    payloads: list[dict[str, Any]] = []
    for row in source_rows:
        nivel = str(_row_value(row, "nivel") or "").strip().lower()
        cuenta_codigo = int(_row_value(row, "cuenta_codigo"))
        empresa_id = _row_value(row, "empresa_id")
        if (
            empresa_id not in CASH_EMPRESA_IDS
            or nivel != "subcuenta"
            or cuenta_codigo not in fondo_account_codes
        ):
            continue

        payload = {field: _row_value(row, field) for field in SALDO_FIELDS}
        payload["nivel"] = "subcuenta"
        payload["cuenta_codigo"] = cuenta_codigo
        payloads.append(payload)
    return payloads


def fetch_cash_saldo_source_rows(
    anio: int,
    mes: int,
    fondo_account_codes: set[int],
) -> list[dict[str, Any]]:
    if not fondo_account_codes:
        return []

    with psycopg.connect(
        **get_source_connection_kwargs(),
        row_factory=dict_row,
    ) as source_conn, source_conn.cursor() as source_cur:
        source_cur.execute(
            SOURCE_SALDOS_QUERY,
            (anio, mes, sorted(fondo_account_codes)),
        )
        return list(source_cur.fetchall())
