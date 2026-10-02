from __future__ import annotations

from decimal import Decimal
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.models.erp.cash_diario_sync import normalize_rubro
from app.models.erp.libro_diario_sync import get_source_connection_kwargs, parse_periodo


SALDOS_QUERY = """
    WITH cuentas_rubro AS (
        SELECT DISTINCT ON (dc.nro_cta)
            dc.nro_cta,
            dc.nombre,
            dc.rubro
        FROM public.dim_cuenta dc
        WHERE regexp_replace(
                  regexp_replace(upper(btrim(COALESCE(dc.rubro, ''))), '[[:space:]]*-[[:space:]]*', '-', 'g'),
                  '[[:space:]]+', ' ', 'g'
              ) LIKE %s
        ORDER BY dc.nro_cta
    )
    SELECT
        lm.empresa_id,
        lm.cuenta_codigo,
        cr.nombre AS cuenta_nombre,
        cr.rubro,
        SUM(lm.saldo_anterior) AS saldo_inicial,
        SUM(lm.saldo_periodo) AS saldo_periodo,
        SUM(lm.saldo_acumulado) AS saldo_final
    FROM public.libro_mayor lm
    JOIN cuentas_rubro cr ON cr.nro_cta = lm.cuenta_codigo
    WHERE lm.periodo_anio = %s
      AND lm.periodo_mes = %s
      AND lm.nivel = 'cuenta'
    GROUP BY lm.empresa_id, lm.cuenta_codigo, cr.nombre, cr.rubro
    ORDER BY lm.empresa_id, lm.cuenta_codigo
"""


def build_libro_mayor_saldos_response(
    rows: list[dict[str, Any]],
    *,
    periodo: str,
    rubro: str,
) -> dict[str, Any]:
    cuentas = []
    saldo_inicial = Decimal("0")
    saldo_periodo = Decimal("0")
    saldo_final = Decimal("0")
    rubros_encontrados: set[str] = set()

    for row in rows:
        inicial = Decimal(str(row.get("saldo_inicial") or 0))
        movimiento = Decimal(str(row.get("saldo_periodo") or 0))
        final = Decimal(str(row.get("saldo_final") or 0))
        saldo_inicial += inicial
        saldo_periodo += movimiento
        saldo_final += final
        if row.get("rubro"):
            rubros_encontrados.add(str(row["rubro"]))
        cuentas.append(
            {
                "empresa_id": int(row["empresa_id"]),
                "cuenta_codigo": int(row["cuenta_codigo"]),
                "cuenta_nombre": row.get("cuenta_nombre"),
                "rubro": row.get("rubro"),
                "saldo_inicial": float(inicial),
                "saldo_periodo": float(movimiento),
                "saldo_final": float(final),
            }
        )

    return {
        "periodo": periodo,
        "rubro": rubro,
        "rubros_encontrados": sorted(rubros_encontrados),
        "cuentas": cuentas,
        "totales": {
            "saldo_inicial": float(saldo_inicial),
            "saldo_periodo": float(saldo_periodo),
            "saldo_final": float(saldo_final),
        },
    }


def get_libro_mayor_saldos(periodo: str, rubro: str) -> dict[str, Any]:
    anio, mes = parse_periodo(periodo)
    rubro_normalizado = normalize_rubro(rubro)
    if not rubro_normalizado:
        raise ValueError("rubro es requerido")

    try:
        with psycopg.connect(
            **get_source_connection_kwargs(),
            row_factory=dict_row,
        ) as source_conn, source_conn.cursor() as source_cur:
            source_cur.execute(SALDOS_QUERY, (f"{rubro_normalizado}%", anio, mes))
            rows = list(source_cur.fetchall())
    except psycopg.Error as exc:
        raise RuntimeError("No se pudo consultar libro_mayor del ERP externo") from exc

    return build_libro_mayor_saldos_response(
        rows,
        periodo=f"{anio:04d}-{mes:02d}",
        rubro=rubro,
    )
