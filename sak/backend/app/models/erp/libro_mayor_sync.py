from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import UTC, date, datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row
from sqlalchemy import delete, insert
from sqlmodel import Session, select

from app.models.erp.libro_diario_sync import get_source_connection_kwargs, parse_periodo
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.proyecto import Proyecto


SOURCE_QUERY = """
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
        lm.fecha_periodo,
        COALESCE((lm.empresa_id NOT IN (3, 4)
      AND lm.centro_costo IS NOT NULL
      AND btrim(lm.centro_costo) <> ''
      AND btrim(lm.centro_costo) <> '0'
      AND btrim(lm.centro_costo) = ANY(%s)
      AND dc.extendido IS NOT NULL
      AND upper(btrim(COALESCE(dc.sub_rubro, ''))) = '01 - OBRAS'
      AND left(btrim(dc.extendido), 1) IN ('4', '5')), false) AS es_obra
    FROM public.libro_mayor lm
    LEFT JOIN public.dim_cuenta dc ON dc.nro_cta = lm.cuenta_codigo
    WHERE lm.periodo_anio = %s AND lm.periodo_mes = %s
      AND lm.nivel = 'subcuenta'
      AND (lm.empresa_id IN (1, 2, 5) OR (lm.empresa_id NOT IN (3, 4)
      AND lm.centro_costo IS NOT NULL
      AND btrim(lm.centro_costo) <> ''
      AND btrim(lm.centro_costo) <> '0'
      AND btrim(lm.centro_costo) = ANY(%s)
      AND dc.extendido IS NOT NULL
      AND upper(btrim(COALESCE(dc.sub_rubro, ''))) = '01 - OBRAS'
      AND left(btrim(dc.extendido), 1) IN ('4', '5')))
    ORDER BY lm.id
"""


LIBRO_MAYOR_FIELDS = (
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


def build_libro_mayor_payloads(source_rows: Iterable[Any]) -> list[dict[str, Any]]:
    return [
        {**{field: _row_value(row, field) for field in LIBRO_MAYOR_FIELDS}, "es_obra": _row_value(row, "es_obra") if _row_value(row, "es_obra") is not None else True}
        for row in source_rows
    ]


def get_allowed_centros_costo(session: Session) -> list[str]:
    values = session.exec(
        select(Proyecto.centro_costo)
        .where(
            Proyecto.centro_costo.is_not(None),
            Proyecto.centro_costo != 0,
        )
        .distinct()
        .order_by(Proyecto.centro_costo)
    ).all()
    return [str(value) for value in values]


def fetch_libro_mayor_source_rows(
    anio: int,
    mes: int,
    allowed_centros: list[str],
) -> list[dict[str, Any]]:
    try:
        with psycopg.connect(
            **get_source_connection_kwargs(),
            row_factory=dict_row,
        ) as source_conn, source_conn.cursor() as source_cur:
            source_cur.execute(SOURCE_QUERY, (allowed_centros, anio, mes, allowed_centros))
            return list(source_cur.fetchall())
    except psycopg.Error as exc:
        raise RuntimeError(
            "No se pudo consultar libro_mayor en la base ERP original"
        ) from exc


def sync_libro_mayor_periodo(
    session: Session,
    periodo: str,
    *,
    source_rows: Iterable[Any] | None = None,
    allowed_centros: list[str] | None = None,
    complete_import: bool = False,
) -> dict[str, int | str]:
    anio, mes = parse_periodo(periodo)
    selected_centros = (
        get_allowed_centros_costo(session)
        if allowed_centros is None
        else allowed_centros
    )
    rows = (
        fetch_libro_mayor_source_rows(anio, mes, selected_centros)
        if source_rows is None
        else list(source_rows)
    )
    payloads = build_libro_mayor_payloads(rows)

    try:
        delete_result = session.exec(
            delete(ErpLibroMayor).where(
                ErpLibroMayor.periodo_anio == anio,
                ErpLibroMayor.periodo_mes == mes,
            )
        )
        deleted_count = int(delete_result.rowcount or 0)
        now = datetime.now(UTC)
        records = [
            {
                **payload,
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
                "version": 1,
            }
            for payload in payloads
        ]
        for offset in range(0, len(records), 5000):
            session.execute(insert(ErpLibroMayor.__table__), records[offset : offset + 5000])
        if source_rows is None or complete_import:
            period = session.exec(select(ErpCashPeriodo).where(
                ErpCashPeriodo.fecha_periodo == date(anio, mes, 1), ErpCashPeriodo.deleted_at.is_(None),
            )).first()
            if period is None:
                period = ErpCashPeriodo(fecha_periodo=date(anio, mes, 1))
            period.mayor_cash_importado = True
            session.add(period)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "rows_read": len(payloads),
        "rows_deleted": deleted_count,
        "rows_inserted": len(payloads),
    }


def _iter_periodos(periodo_desde: str, periodo_hasta: str):
    anio_desde, mes_desde = parse_periodo(periodo_desde)
    anio_hasta, mes_hasta = parse_periodo(periodo_hasta)
    start_index = anio_desde * 12 + mes_desde - 1
    end_index = anio_hasta * 12 + mes_hasta - 1
    if end_index < start_index:
        raise ValueError("periodo_hasta debe ser mayor o igual a periodo_desde")
    for month_index in range(start_index, end_index + 1):
        yield month_index // 12, month_index % 12 + 1


def sync_libro_mayor_rango(
    session: Session,
    periodo_desde: str,
    periodo_hasta: str,
) -> dict[str, object]:
    periodos = list(_iter_periodos(periodo_desde, periodo_hasta))
    allowed_centros = get_allowed_centros_costo(session)
    resultados = []
    try:
        with psycopg.connect(
            **get_source_connection_kwargs(),
            row_factory=dict_row,
        ) as source_conn, source_conn.cursor() as source_cur:
            for anio, mes in periodos:
                source_cur.execute(SOURCE_QUERY, (allowed_centros, anio, mes, allowed_centros))
                source_rows = source_cur.fetchall()
                resultados.append(
                    sync_libro_mayor_periodo(
                        session,
                        f"{anio:04d}{mes:02d}",
                        source_rows=source_rows,
                        allowed_centros=allowed_centros,
                        complete_import=True,
                    )
                )
    except psycopg.Error as exc:
        raise RuntimeError(
            "No se pudo consultar libro_mayor en la base ERP original"
        ) from exc

    return {
        "periodo_desde": f"{periodos[0][0]:04d}-{periodos[0][1]:02d}",
        "periodo_hasta": f"{periodos[-1][0]:04d}-{periodos[-1][1]:02d}",
        "periodos": len(resultados),
        "rows_read": sum(int(result["rows_read"]) for result in resultados),
        "rows_deleted": sum(int(result["rows_deleted"]) for result in resultados),
        "rows_inserted": sum(int(result["rows_inserted"]) for result in resultados),
        "resultados": resultados,
    }
