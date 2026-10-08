from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal, InvalidOperation
from types import SimpleNamespace
from typing import Any

import psycopg
from psycopg.rows import dict_row
from sqlalchemy import delete, func
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.cash_subcta import ErpCashSubcta
from app.models.erp.cash_saldo_sync import (
    build_cash_saldo_payloads,
    fetch_cash_saldo_source_rows,
)
from app.models.erp.libro_diario_sync import get_source_connection_kwargs, parse_periodo


CASH_EMPRESA_IDS = frozenset({1, 2, 5})


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
      AND ld.empresa_id IN (1, 2, 5)
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


def normalize_categoria(value: object) -> str:
    return " ".join(str(value or "").strip().split()).casefold()


def _subcuenta_key(row: Any) -> tuple[int, int] | None:
    tipo = str(getattr(row, "tipo_subcuenta", "") or "").strip()
    numero = str(getattr(row, "nro_subcuenta", "") or "").strip()
    if not tipo or not numero:
        return None
    try:
        return int(tipo), int(numero)
    except ValueError:
        return None


def _resolve_mapping(
    cuenta_codigo: int,
    subcuenta_key: tuple[int, int] | None,
    mappings_by_key: dict[tuple[int, str], ErpCashMap],
    categories_by_subcuenta: dict[tuple[int, int], str],
) -> ErpCashMap | None:
    if subcuenta_key is not None:
        categoria = normalize_categoria(categories_by_subcuenta.get(subcuenta_key, "ERROR"))
        specific_mapping = mappings_by_key.get((cuenta_codigo, categoria))
        if specific_mapping is not None:
            return specific_mapping
    return mappings_by_key.get((cuenta_codigo, ""))


def build_cash_diario_payloads(
    source_rows: Iterable[Any],
    rubros_by_cuenta: dict[int, str],
    mappings_by_key: dict[tuple[int, str], ErpCashMap],
    fondo_mappings_by_cuenta: dict[int, ErpCashMap],
    categories_by_subcuenta: dict[tuple[int, int], str],
) -> list[dict[str, Any]]:
    rows = [row for row in source_rows if row.empresa_id in CASH_EMPRESA_IDS]
    fondo_account_codes = set(fondo_mappings_by_cuenta)
    cash_asientos = {
        _asiento_key(row)
        for row in rows
        if row.cuenta_codigo in fondo_account_codes
    }

    payloads: list[dict[str, Any]] = []
    for row in rows:
        if _asiento_key(row) not in cash_asientos:
            continue

        rubro = rubros_by_cuenta.get(row.cuenta_codigo)
        cuenta_cash_id = None

        mapping = (
            fondo_mappings_by_cuenta.get(row.cuenta_codigo)
            if row.cuenta_codigo in fondo_account_codes
            else _resolve_mapping(
                row.cuenta_codigo,
                _subcuenta_key(row),
                mappings_by_key,
                categories_by_subcuenta,
            )
        )
        if mapping is not None:
            if row.cuenta_codigo in fondo_account_codes:
                cuenta_cash_id = mapping.map_debe_id
            else:
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


def get_fondo_mappings_by_cuenta(session: Session) -> dict[int, ErpCashMap]:
    mappings = session.exec(
        select(ErpCashMap)
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashMap.map_debe_id)
        .where(
            ErpCashMap.deleted_at.is_(None),
            ErpCashCuenta.deleted_at.is_(None),
            func.upper(func.trim(ErpCashCuenta.tipo)) == "FONDO",
        )
        .order_by(ErpCashMap.id)
    ).all()

    mappings_by_cuenta: dict[int, ErpCashMap] = {}
    for mapping in mappings:
        mappings_by_cuenta.setdefault(mapping.nro_cta, mapping)
    return mappings_by_cuenta


def sync_cash_diario_periodo(
    session: Session,
    periodo: str,
    *,
    source_data: tuple[Iterable[Any], dict[int, str]] | None = None,
    saldo_source_rows: Iterable[Any] | None = None,
) -> dict[str, int | str]:
    anio, mes = parse_periodo(periodo)
    if source_data is None:
        source_rows, rubros_by_cuenta = fetch_source_rows(anio, mes)
    else:
        provided_rows, rubros_by_cuenta = source_data
        source_rows = list(provided_rows)

    mappings_by_key: dict[tuple[int, str], ErpCashMap] = {}
    mappings = session.exec(
        select(ErpCashMap)
        .where(ErpCashMap.deleted_at.is_(None))
        .order_by(ErpCashMap.id)
    ).all()
    for mapping in mappings:
        # Los duplicados se resuelven de forma deterministica con el menor ID.
        mapping_key = (mapping.nro_cta, normalize_categoria(mapping.categoria))
        mappings_by_key.setdefault(mapping_key, mapping)

    fondo_mappings_by_cuenta = get_fondo_mappings_by_cuenta(session)
    if not fondo_mappings_by_cuenta:
        raise ValueError("No hay cuentas contables mapeadas a una cuenta Cash tipo Fondo")

    fondo_account_codes = set(fondo_mappings_by_cuenta)

    cash_asientos = {
        _asiento_key(row)
        for row in source_rows
        if row.empresa_id in CASH_EMPRESA_IDS and row.cuenta_codigo in fondo_account_codes
    }
    cash_rows = [
        row
        for row in source_rows
        if row.empresa_id in CASH_EMPRESA_IDS and _asiento_key(row) in cash_asientos
    ]
    stored_subcuentas = session.exec(select(ErpCashSubcta).order_by(ErpCashSubcta.id)).all()
    active_subcuentas: dict[tuple[int, int], ErpCashSubcta] = {}
    deleted_subcuentas: dict[tuple[int, int], ErpCashSubcta] = {}
    for subcuenta in stored_subcuentas:
        key = (subcuenta.tpo_subcta, subcuenta.nro_subcta)
        if subcuenta.deleted_at is None:
            active_subcuentas.setdefault(key, subcuenta)
        else:
            deleted_subcuentas.setdefault(key, subcuenta)

    categories_by_subcuenta = {
        key: subcuenta.categoria for key, subcuenta in active_subcuentas.items()
    }
    new_subcuentas: list[ErpCashSubcta] = []
    revived_subcuentas: list[tuple[ErpCashSubcta, str]] = []
    for row in cash_rows:
        subcuenta_key = _subcuenta_key(row)
        if subcuenta_key is None or subcuenta_key in categories_by_subcuenta:
            continue
        description = str(getattr(row, "descripcion", "") or "").strip()
        if not description:
            description = f"Subcuenta {subcuenta_key[0]}-{subcuenta_key[1]}"
        description = description[:255]
        deleted_subcuenta = deleted_subcuentas.get(subcuenta_key)
        if deleted_subcuenta is not None:
            revived_subcuentas.append((deleted_subcuenta, description))
        else:
            new_subcuentas.append(
                ErpCashSubcta(
                    tpo_subcta=subcuenta_key[0],
                    nro_subcta=subcuenta_key[1],
                    descripcion=description,
                    categoria="ERROR",
                )
            )
        categories_by_subcuenta[subcuenta_key] = "ERROR"

    payloads = build_cash_diario_payloads(
        source_rows,
        rubros_by_cuenta,
        mappings_by_key,
        fondo_mappings_by_cuenta,
        categories_by_subcuenta,
    )
    if saldo_source_rows is None:
        provided_saldo_rows = fetch_cash_saldo_source_rows(
            anio,
            mes,
            fondo_account_codes,
        )
    else:
        provided_saldo_rows = list(saldo_source_rows)
    saldo_payloads = build_cash_saldo_payloads(
        provided_saldo_rows,
        fondo_account_codes,
    )

    deleted_count = session.scalar(
        select(func.count())
        .select_from(ErpCashDiario)
        .where(
            ErpCashDiario.periodo_anio == anio,
            ErpCashDiario.periodo_mes == mes,
        )
    ) or 0
    saldos_deleted_count = session.scalar(
        select(func.count())
        .select_from(ErpCashSaldo)
        .where(
            ErpCashSaldo.periodo_anio == anio,
            ErpCashSaldo.periodo_mes == mes,
        )
    ) or 0

    try:
        for subcuenta, description in revived_subcuentas:
            subcuenta.deleted_at = None
            subcuenta.descripcion = description
            subcuenta.categoria = "ERROR"
            subcuenta.version += 1
            session.add(subcuenta)
        session.add_all(new_subcuentas)
        session.exec(
            delete(ErpCashDiario).where(
                ErpCashDiario.periodo_anio == anio,
                ErpCashDiario.periodo_mes == mes,
            )
        )
        session.add_all(ErpCashDiario(**payload) for payload in payloads)
        session.exec(
            delete(ErpCashSaldo).where(
                ErpCashSaldo.periodo_anio == anio,
                ErpCashSaldo.periodo_mes == mes,
            )
        )
        session.add_all(ErpCashSaldo(**payload) for payload in saldo_payloads)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "rows_deleted": int(deleted_count),
        "rows_inserted": len(payloads),
        "saldos_deleted": int(saldos_deleted_count),
        "saldos_inserted": len(saldo_payloads),
        "cuentas_fondo": len(fondo_account_codes),
    }
