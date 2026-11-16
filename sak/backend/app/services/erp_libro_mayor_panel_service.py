from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import String, case, cast, func
from sqlmodel import Session, select

from app.models.erp.cuenta import ErpCuenta
from app.models.erp.indice import ErpIndice
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.rubro import ErpRubro
from app.models.proyecto import Proyecto


PANEL_START_YEAR = 2024
OPENING_BALANCE_ICC_PERIOD = date(2023, 12, 1)


def _get_opening_balance_icc_factor(session: Session) -> Decimal:
    base_index = session.exec(
        select(ErpIndice)
        .where(
            ErpIndice.codigo == "ICC",
            ErpIndice.fecha == OPENING_BALANCE_ICC_PERIOD,
            ErpIndice.deleted_at.is_(None),
        )
        .order_by(ErpIndice.id.desc())
    ).first()
    if base_index is None:
        raise ValueError("No existe un valor ICC para el período 2023-12")

    target_period = date.today().replace(day=1)
    target_index = session.exec(
        select(ErpIndice)
        .where(
            ErpIndice.codigo == "ICC",
            ErpIndice.fecha <= target_period,
            ErpIndice.deleted_at.is_(None),
        )
        .order_by(ErpIndice.fecha.desc(), ErpIndice.id.desc())
    ).first()
    if target_index is None:
        raise ValueError(
            "No existe un valor ICC para el período actual ni para períodos anteriores"
        )

    base_value = Decimal(str(base_index.valor))
    target_value = Decimal(str(target_index.valor))
    if base_value <= 0:
        raise ValueError("El valor ICC de 2023-12 debe ser mayor a cero")
    if target_value <= 0:
        raise ValueError(
            f"El valor ICC de {target_index.fecha:%Y-%m} debe ser mayor a cero"
        )
    return target_value / base_value


def _empty_year_values(years: list[int]) -> dict[str, dict[str, float]]:
    return {
        str(year): {"historico": 0.0, "actual": 0.0}
        for year in years
    }


def _empty_values() -> dict[str, float]:
    return {"historico": 0.0, "actual": 0.0}


def _add_year_values(
    target: dict[str, dict[str, float]],
    year: int,
    historical: Decimal | int | float | None,
    current: Decimal | int | float | None,
) -> None:
    key = str(year)
    target[key]["historico"] += float(historical or 0)
    target[key]["actual"] += float(current or 0)


def _add_values(
    target: dict[str, float],
    historical: Decimal | int | float | None,
    current: Decimal | int | float | None,
) -> None:
    target["historico"] += float(historical or 0)
    target["actual"] += float(current or 0)


def _set_total(entity: dict, years: list[int]) -> None:
    entity["total"] = {
        key: entity["saldo_inicial"][key]
        + sum(entity["years"][str(year)][key] for year in years)
        for key in ("historico", "actual")
    }


def get_libro_mayor_reales_panel(
    session: Session,
    *,
    anio_desde: int = PANEL_START_YEAR,
    anio_hasta: int | None = None,
    estado: str | None = "02-ejecucion",
    proyecto_id: int | None = None,
) -> dict[str, object]:
    """Agrupa los valores reales originales y actualizados por proyecto y cuenta."""
    end_year = anio_hasta or date.today().year
    if anio_desde < PANEL_START_YEAR:
        raise ValueError(f"anio_desde no puede ser anterior a {PANEL_START_YEAR}")
    if end_year < anio_desde:
        raise ValueError("anio_hasta debe ser mayor o igual a anio_desde")

    years = list(range(anio_desde, end_year + 1))
    opening_balance_icc_factor = _get_opening_balance_icc_factor(session)
    historical_expr = func.coalesce(
        func.sum(ErpLibroMayor.total_debe + ErpLibroMayor.total_haber),
        0,
    ).label("historico")
    current_expr = func.coalesce(
        func.sum(
            func.coalesce(
                ErpLibroMayor.total_debe_actualizado,
                ErpLibroMayor.total_debe,
            )
            + func.coalesce(
                ErpLibroMayor.total_haber_actualizado,
                ErpLibroMayor.total_haber,
            )
        ),
        0,
    ).label("actual")
    opening_balance_expr = func.coalesce(
        func.sum(
            case(
                (
                    (ErpLibroMayor.periodo_anio == anio_desde)
                    & (ErpLibroMayor.periodo_mes == 1),
                    ErpLibroMayor.saldo_anterior,
                ),
                else_=0,
            )
        ),
        0,
    ).label("saldo_inicial")

    stmt = (
        select(
            Proyecto.id.label("proyecto_id"),
            Proyecto.nombre.label("proyecto_nombre"),
            ErpRubro.id.label("rubro_id"),
            ErpRubro.nombre.label("rubro_nombre"),
            ErpCuenta.id.label("cuenta_id"),
            ErpCuenta.cod_cuenta.label("cuenta_codigo"),
            ErpCuenta.descripcion.label("cuenta_nombre"),
            ErpCuenta.nro_cuenta.label("cuenta_orden"),
            ErpLibroMayor.periodo_anio.label("year"),
            historical_expr,
            current_expr,
            opening_balance_expr,
        )
        .join(
            Proyecto,
            (Proyecto.deleted_at.is_(None))
            & (Proyecto.centro_costo.is_not(None))
            & (
                cast(Proyecto.centro_costo, String)
                == func.trim(ErpLibroMayor.centro_costo)
            ),
        )
        .join(
            ErpCuenta,
            (ErpCuenta.deleted_at.is_(None))
            & (ErpCuenta.nro_cuenta == ErpLibroMayor.cuenta_codigo),
        )
        .join(
            ErpRubro,
            (ErpRubro.deleted_at.is_(None))
            & (ErpRubro.id == ErpCuenta.rubro_id),
        )
        .where(
            ErpLibroMayor.deleted_at.is_(None),
            ErpLibroMayor.es_obra.is_(True),
            ErpLibroMayor.periodo_anio >= anio_desde,
            ErpLibroMayor.periodo_anio <= end_year,
            func.lower(ErpLibroMayor.nivel) == "subcuenta",
        )
        .group_by(
            Proyecto.id,
            Proyecto.nombre,
            ErpRubro.id,
            ErpRubro.nombre,
            ErpCuenta.id,
            ErpCuenta.cod_cuenta,
            ErpCuenta.descripcion,
            ErpCuenta.nro_cuenta,
            ErpLibroMayor.periodo_anio,
        )
        .order_by(
            Proyecto.nombre,
            ErpRubro.nombre,
            ErpCuenta.nro_cuenta,
            ErpCuenta.cod_cuenta,
            ErpLibroMayor.periodo_anio,
        )
    )
    if proyecto_id is not None:
        stmt = stmt.where(Proyecto.id == proyecto_id)
    if estado and estado != "all":
        stmt = stmt.where(Proyecto.estado == estado)

    rows = session.exec(stmt).all()
    projects: dict[int, dict] = {}
    rubros_by_project: dict[int, dict[int, dict]] = defaultdict(dict)
    cuentas_by_rubro: dict[tuple[int, int], dict[int, dict]] = defaultdict(dict)

    for row in rows:
        project = projects.get(row.proyecto_id)
        if project is None:
            project = {
                "proyecto_id": row.proyecto_id,
                "proyecto_nombre": row.proyecto_nombre,
                "saldo_inicial": _empty_values(),
                "years": _empty_year_values(years),
                "total": _empty_values(),
                "rubros": [],
            }
            projects[row.proyecto_id] = project

        rubro = rubros_by_project[row.proyecto_id].get(row.rubro_id)
        if rubro is None:
            rubro = {
                "rubro_id": row.rubro_id,
                "rubro_nombre": row.rubro_nombre,
                "saldo_inicial": _empty_values(),
                "years": _empty_year_values(years),
                "total": _empty_values(),
                "cuentas": [],
            }
            rubros_by_project[row.proyecto_id][row.rubro_id] = rubro
            project["rubros"].append(rubro)

        cuenta_key = (row.proyecto_id, row.rubro_id)
        cuenta = cuentas_by_rubro[cuenta_key].get(row.cuenta_id)
        if cuenta is None:
            cuenta = {
                "cuenta_id": row.cuenta_id,
                "cuenta_codigo": row.cuenta_codigo,
                "cuenta_numero": row.cuenta_orden,
                "cuenta_nombre": row.cuenta_nombre,
                "saldo_inicial": _empty_values(),
                "years": _empty_year_values(years),
                "total": _empty_values(),
            }
            cuentas_by_rubro[cuenta_key][row.cuenta_id] = cuenta
            rubro["cuentas"].append(cuenta)

        # El ERP guarda Debe positivo y Haber negativo. Para la vista de
        # gestión se invierte el saldo contable: ingresos positivos y costos negativos.
        historical = -Decimal(str(row.historico or 0))
        current = -Decimal(str(row.actual or 0))
        opening_balance = -Decimal(str(row.saldo_inicial or 0))
        opening_balance_current = opening_balance * opening_balance_icc_factor
        _add_values(
            project["saldo_inicial"],
            opening_balance,
            opening_balance_current,
        )
        _add_values(
            rubro["saldo_inicial"],
            opening_balance,
            opening_balance_current,
        )
        _add_values(
            cuenta["saldo_inicial"],
            opening_balance,
            opening_balance_current,
        )
        _add_year_values(project["years"], int(row.year), historical, current)
        _add_year_values(rubro["years"], int(row.year), historical, current)
        _add_year_values(cuenta["years"], int(row.year), historical, current)

    for project in projects.values():
        _set_total(project, years)
        for rubro in project["rubros"]:
            _set_total(rubro, years)
            for cuenta in rubro["cuentas"]:
                _set_total(cuenta, years)

    return {
        "anio_desde": anio_desde,
        "anio_hasta": end_year,
        "estado": estado,
        "years": years,
        "rows": list(projects.values()),
    }
