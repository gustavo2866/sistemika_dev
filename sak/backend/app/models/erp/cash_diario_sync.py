from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal, InvalidOperation
from types import SimpleNamespace
from typing import Any

import psycopg
from psycopg.rows import dict_row
from sqlalchemy import delete, func
from sqlmodel import Session, select

from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.libro_diario_sync import get_source_connection_kwargs, parse_periodo


SOURCE_QUERY = """
    SELECT
        ld.id AS source_id,
        ld.empresa_id,
        ld.fecha,
        ld.periodo_anio,
        ld.periodo_mes,
        ld.tipo_asiento,
        ld.nro_asiento,
        ld.nro_renglon,
        ld.cuenta_codigo,
        ld.debe,
        ld.haber,
        ld.descripcion,
        ld.tipo_subcuenta,
        ld.nro_subcuenta,
        ld.centro_costo,
        ld.cargado_en,
        ld.archivo_origen,
        dc.rubro
    FROM public.libro_diario ld
    LEFT JOIN public.dim_cuenta dc ON dc.nro_cta = ld.cuenta_codigo
    WHERE ld.periodo_anio = %s
      AND ld.periodo_mes = %s
    ORDER BY ld.id
"""


def normalize_rubro(value: str | None) -> str:
    if value is None:
        return ""
    normalized = " ".join(value.strip().split())
    normalized = normalized.replace(" - ", "-").replace(" -", "-").replace("- ", "-")
    return normalized.upper()


def _has_value(value: object) -> bool:
    try:
        return Decimal(str(value or 0)) != 0
    except InvalidOperation:
        return False


def _asiento_key(row: Any) -> tuple[object, ...]:
    return (
        row.empresa_id,
        row.fecha,
        str(row.tipo_asiento or ""),
        str(row.nro_asiento or ""),
    )


def build_cash_diario_payloads(
    source_rows: Iterable[Any],
    rubros_by_cuenta: dict[int, str],
    mappings_by_cuenta: dict[int, ErpCashMap],
) -> list[dict[str, Any]]:
    rows = list(source_rows)
    cash_asientos = {
        _asiento_key(row)
        for row in rows
        if normalize_rubro(rubros_by_cuenta.get(row.cuenta_codigo)).startswith("01-DISP")
    }

    payloads: list[dict[str, Any]] = []
    for row in rows:
        if _asiento_key(row) not in cash_asientos:
            continue

        rubro = rubros_by_cuenta.get(row.cuenta_codigo)
        normalized_rubro = normalize_rubro(rubro)
        cuenta_cash_id = None

        if not normalized_rubro.startswith("01-DISP"):
            mapping = mappings_by_cuenta.get(row.cuenta_codigo)
            if mapping is not None:
                if _has_value(row.debe):
                    cuenta_cash_id = mapping.map_debe_id
                elif _has_value(row.haber):
                    cuenta_cash_id = mapping.map_haber_id

        payloads.append(
            {
                "source_id": row.source_id,
                "empresa_id": row.empresa_id,
                "fecha": row.fecha,
                "periodo_anio": row.periodo_anio,
                "periodo_mes": row.periodo_mes,
                "tipo_asiento": row.tipo_asiento,
                "nro_asiento": row.nro_asiento,
                "nro_renglon": row.nro_renglon,
                "cuenta_codigo": row.cuenta_codigo,
                "debe": row.debe,
                "haber": row.haber,
                "descripcion": row.descripcion,
                "tipo_subcuenta": row.tipo_subcuenta,
                "nro_subcuenta": row.nro_subcuenta,
                "centro_costo": row.centro_costo,
                "cargado_en": row.cargado_en,
                "archivo_origen": row.archivo_origen,
                "rubro": rubro,
                "cash": "SI",
                "cuenta_cash_id": cuenta_cash_id,
            }
        )

    return payloads


def fetch_source_rows(anio: int, mes: int) -> tuple[list[Any], dict[int, str]]:
    rubros_by_cuenta: dict[int, str] = {}
    with psycopg.connect(
        **get_source_connection_kwargs(),
        row_factory=dict_row,
    ) as source_conn, source_conn.cursor() as source_cur:
        source_cur.execute(SOURCE_QUERY, (anio, mes))
        raw_rows = source_cur.fetchall()

    source_rows = []
    for raw_row in raw_rows:
        rubro = raw_row.pop("rubro", None)
        cuenta_codigo = int(raw_row["cuenta_codigo"])
        if rubro is not None:
            rubros_by_cuenta.setdefault(cuenta_codigo, str(rubro))
        source_rows.append(SimpleNamespace(**raw_row))

    return source_rows, rubros_by_cuenta


def sync_cash_diario_periodo(
    session: Session,
    periodo: str,
    *,
    source_data: tuple[Iterable[Any], dict[int, str]] | None = None,
) -> dict[str, int | str]:
    anio, mes = parse_periodo(periodo)
    if source_data is None:
        source_rows, rubros_by_cuenta = fetch_source_rows(anio, mes)
    else:
        provided_rows, rubros_by_cuenta = source_data
        source_rows = list(provided_rows)

    mappings_by_cuenta: dict[int, ErpCashMap] = {}
    mappings = session.exec(
        select(ErpCashMap)
        .where(ErpCashMap.deleted_at.is_(None))
        .order_by(ErpCashMap.id)
    ).all()
    for mapping in mappings:
        # Los duplicados se resuelven de forma deterministica con el menor ID.
        mappings_by_cuenta.setdefault(mapping.nro_cta, mapping)

    payloads = build_cash_diario_payloads(
        source_rows,
        rubros_by_cuenta,
        mappings_by_cuenta,
    )

    deleted_count = session.scalar(
        select(func.count())
        .select_from(ErpCashDiario)
        .where(
            ErpCashDiario.periodo_anio == anio,
            ErpCashDiario.periodo_mes == mes,
        )
    ) or 0

    try:
        session.exec(
            delete(ErpCashDiario).where(
                ErpCashDiario.periodo_anio == anio,
                ErpCashDiario.periodo_mes == mes,
            )
        )
        session.add_all(ErpCashDiario(**payload) for payload in payloads)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "rows_deleted": int(deleted_count),
        "rows_inserted": len(payloads),
    }
