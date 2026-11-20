from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import delete, func
from sqlmodel import Session, select

from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.cash_subcta import ErpCashSubcta
from app.models.erp.cash_saldo_sync import (
    build_cash_saldo_payloads,
    fetch_cash_saldo_source_rows,
)
from app.models.erp.libro_diario_sync import parse_periodo
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.rubro import ErpRubro
from app.services.erp_cash_mapping_service import (
    build_cash_mappings_by_key,
    get_fondo_mappings_by_cuenta,
    normalize_cash_category,
    resolve_cash_account_id,
)


CASH_EMPRESA_IDS = frozenset({1, 2, 5})


class CashPeriodoCerradoError(ValueError):
    """El periodo debe reabrirse antes de reemplazar sus datos reales."""




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


normalize_categoria = normalize_cash_category


def _subcuenta_key(row: Any) -> tuple[int, int] | None:
    get_value = row.get if isinstance(row, Mapping) else lambda field: getattr(row, field, None)
    tipo = str(get_value("tipo_subcuenta") or "").strip()
    numero = str(get_value("nro_subcuenta") or "").strip()
    if not tipo or not numero:
        return None
    try:
        return int(tipo), int(numero)
    except ValueError:
        return None


def build_cash_diario_payloads(
    source_rows: Iterable[Any],
    rubros_by_cuenta: dict[int, str],
    mappings_by_key: dict[tuple[int, str], ErpCashMap],
    fondo_mappings_by_cuenta: dict[int, ErpCashMap],
    categories_by_subcuenta: dict[tuple[int, int], str],
    states_by_subcuenta: dict[tuple[int, int], str] | None = None,
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
        side = "debe" if _has_value(row.debe) else "haber" if _has_value(row.haber) else None
        cuenta_cash_id = resolve_cash_account_id(
            cuenta_codigo=row.cuenta_codigo,
            side=side,
            subcuenta_key=_subcuenta_key(row),
            mappings_by_key=mappings_by_key,
            fondo_mappings_by_cuenta=fondo_mappings_by_cuenta,
            categories_by_subcuenta=categories_by_subcuenta,
            states_by_subcuenta=states_by_subcuenta,
        )

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


def fetch_source_rows(session: Session, anio: int, mes: int) -> tuple[list[Any], dict[int, str]]:
    rows = session.exec(select(ErpLibroDiario).where(
        ErpLibroDiario.periodo_anio == anio, ErpLibroDiario.periodo_mes == mes,
        ErpLibroDiario.empresa_id.in_(CASH_EMPRESA_IDS), ErpLibroDiario.deleted_at.is_(None),
    ).order_by(ErpLibroDiario.source_id)).all()
    rubros = session.exec(select(ErpCuenta.nro_cuenta, ErpRubro.nombre)
        .join(ErpRubro, ErpRubro.id == ErpCuenta.rubro_id)
        .where(ErpCuenta.deleted_at.is_(None), ErpRubro.deleted_at.is_(None))).all()
    return list(rows), dict(rubros)


def remap_closed_cash_diario_periodo(session: Session, month: date) -> dict[str, int]:
    """Reaplica destinos sobre Cash guardado sin reemplazar los reales cerrados.

    El llamador bloquea el período y confirma la transacción con las proyecciones.
    """
    mappings = build_cash_mappings_by_key(session)
    fondos = get_fondo_mappings_by_cuenta(session)
    subcuentas = session.exec(select(ErpCashSubcta).order_by(ErpCashSubcta.id)).all()
    categories = {
        (sub.tpo_subcta, sub.nro_subcta): sub.categoria
        for sub in subcuentas if sub.deleted_at is None and sub.estado == "activa"
    }
    states = {
        (sub.tpo_subcta, sub.nro_subcta): sub.estado
        for sub in subcuentas if sub.deleted_at is None or sub.estado == "bloqueada"
    }
    rows = session.exec(select(ErpCashDiario).where(
        ErpCashDiario.periodo_anio == month.year,
        ErpCashDiario.periodo_mes == month.month,
        ErpCashDiario.deleted_at.is_(None),
    )).all()
    for row in rows:
        key = _subcuenta_key(row)
        account_id = resolve_cash_account_id(
            cuenta_codigo=row.cuenta_codigo,
            side="debe" if _has_value(row.debe) else "haber" if _has_value(row.haber) else None,
            subcuenta_key=key,
            mappings_by_key=mappings,
            fondo_mappings_by_cuenta=fondos,
            categories_by_subcuenta=categories,
            states_by_subcuenta=states,
        )
        if row.cuenta_cash_id != account_id:
            row.cuenta_cash_id = account_id
            row.updated_at = datetime.now(timezone.utc)
            row.version += 1
            session.add(row)
    # Recuperar renglones antes omitidos por estado, sin reemplazar el histórico.
    source_rows, rubros = fetch_source_rows(session, month.year, month.month)
    existing_sources = set(session.exec(select(ErpCashDiario.source_id)).all())
    missing = [payload for payload in build_cash_diario_payloads(
        source_rows, rubros, mappings, fondos, categories, states,
    ) if payload["source_id"] not in existing_sources]
    session.add_all(ErpCashDiario(**payload) for payload in missing)
    saldo_sources = set(session.exec(select(ErpCashSaldo.source_id)).all())
    missing_saldos = [payload for payload in build_cash_saldo_payloads(
        fetch_cash_saldo_source_rows(session, month.year, month.month, set(fondos)), set(fondos),
    ) if payload["source_id"] not in saldo_sources]
    session.add_all(ErpCashSaldo(**payload) for payload in missing_saldos)
    if missing or missing_saldos:
        period = session.exec(select(ErpCashPeriodo).where(
            ErpCashPeriodo.fecha_periodo == month, ErpCashPeriodo.deleted_at.is_(None),
        )).one()
        period.movimientos_count = len(rows) + len(missing)
        session.flush()
        period.saldos_count = session.scalar(select(func.count()).select_from(ErpCashSaldo).where(
            ErpCashSaldo.periodo_anio == month.year, ErpCashSaldo.periodo_mes == month.month,
            ErpCashSaldo.deleted_at.is_(None),
        )) or 0
        period.updated_at = datetime.now(timezone.utc)
        period.version += 1
        session.add(period)
    return {"movimientos": len(rows) + len(missing), "saldos_recuperados": len(missing_saldos)}


def sync_cash_diario_periodo(
    session: Session,
    periodo: str,
    *,
    source_data: tuple[Iterable[Any], dict[int, str]] | None = None,
    saldo_source_rows: Iterable[Any] | None = None,
    auto_commit: bool = True,
    include_closed: bool = False,
    require_complete_sources: bool = True,
) -> dict[str, int | str]:
    anio, mes = parse_periodo(periodo)
    cash_period = session.exec(
        select(ErpCashPeriodo).where(
            ErpCashPeriodo.fecha_periodo == date(anio, mes, 1),
            ErpCashPeriodo.deleted_at.is_(None),
        ).with_for_update()
    ).first()
    if cash_period is not None and cash_period.estado == "CERRADO":
        raise CashPeriodoCerradoError(
            f"El periodo {anio:04d}-{mes:02d} esta cerrado; debe reabrirse para sincronizarlo"
        )
    if source_data is None:
        if require_complete_sources and (cash_period is None or not cash_period.diario_cash_importado or not cash_period.mayor_cash_importado):
            raise ValueError(f"Faltan libros locales completos de {anio:04d}-{mes:02d}. Ejecutar Sincronizar ERP para ese período antes de reconstruir Cash")
        source_rows, rubros_by_cuenta = fetch_source_rows(session, anio, mes)
    else:
        provided_rows, rubros_by_cuenta = source_data
        source_rows = list(provided_rows)

    diary_available = source_data is not None or bool(source_rows) or bool(cash_period and cash_period.diario_cash_importado)
    mayor_available = saldo_source_rows is not None or bool(cash_period and cash_period.mayor_cash_importado)
    if not mayor_available:
        mayor_available = session.exec(select(ErpLibroMayor.id).where(
            ErpLibroMayor.periodo_anio == anio, ErpLibroMayor.periodo_mes == mes,
            ErpLibroMayor.deleted_at.is_(None),
        ).limit(1)).first() is not None

    mappings_by_key = build_cash_mappings_by_key(session)

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
        key: subcuenta.categoria for key, subcuenta in active_subcuentas.items() if subcuenta.estado == "activa"
    }
    states_by_subcuenta = {
        (subcuenta.tpo_subcta, subcuenta.nro_subcta): subcuenta.estado
        for subcuenta in stored_subcuentas
        if subcuenta.deleted_at is None or subcuenta.estado == "bloqueada"
    }
    new_subcuentas: list[ErpCashSubcta] = []
    revived_subcuentas: list[tuple[ErpCashSubcta, str]] = []
    for row in cash_rows:
        subcuenta_key = _subcuenta_key(row)
        if subcuenta_key is None or subcuenta_key in states_by_subcuenta:
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
                    categoria=None,
                    estado="error",
                )
            )
        states_by_subcuenta[subcuenta_key] = "error"

    payloads = build_cash_diario_payloads(
        source_rows,
        rubros_by_cuenta,
        mappings_by_key,
        fondo_mappings_by_cuenta,
        categories_by_subcuenta,
        states_by_subcuenta,
    )
    if saldo_source_rows is None:
        provided_saldo_rows = fetch_cash_saldo_source_rows(
            session, anio,
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
            subcuenta.categoria = None
            subcuenta.estado = "error"
            subcuenta.version += 1
            session.add(subcuenta)
        session.add_all(new_subcuentas)
        if diary_available:
            session.exec(
                delete(ErpCashDiario).where(
                    ErpCashDiario.periodo_anio == anio,
                    ErpCashDiario.periodo_mes == mes,
                )
            )
            session.add_all(ErpCashDiario(**payload) for payload in payloads)
        if mayor_available:
            session.exec(
                delete(ErpCashSaldo).where(
                    ErpCashSaldo.periodo_anio == anio,
                    ErpCashSaldo.periodo_mes == mes,
                )
            )
            session.add_all(ErpCashSaldo(**payload) for payload in saldo_payloads)
        if cash_period is None:
            cash_period = ErpCashPeriodo(fecha_periodo=date(anio, mes, 1))
        else:
            cash_period.version += 1
        cash_period.ultima_sincronizacion = datetime.now(timezone.utc)
        cash_period.updated_at = cash_period.ultima_sincronizacion
        cash_period.movimientos_count = len(payloads) if diary_available else int(deleted_count)
        cash_period.saldos_count = len(saldo_payloads) if mayor_available else int(saldos_deleted_count)
        session.add(cash_period)
        if auto_commit:
            session.commit()
        else:
            session.flush()
    except Exception:
        session.rollback()
        raise

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "rows_deleted": int(deleted_count) if diary_available else 0,
        "rows_inserted": len(payloads),
        "saldos_deleted": int(saldos_deleted_count) if mayor_available else 0,
        "saldos_inserted": len(saldo_payloads),
        "cuentas_fondo": len(fondo_account_codes),
    }
