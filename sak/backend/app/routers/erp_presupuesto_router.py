from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import Depends, Query
from sqlalchemy import extract, func
from sqlmodel import Session, select

from app.core.router import create_generic_router
from app.core.nested_crud import NestedCRUD
from app.db import get_session
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.erp.rubro import ErpRubro
from app.models.proyecto import Proyecto

erp_presupuesto_crud = NestedCRUD(ErpPresupuesto, nested_relations={})

erp_presupuesto_router = create_generic_router(
    model=ErpPresupuesto,
    crud=erp_presupuesto_crud,
    prefix="/erp/presupuestos",
    tags=["erp-presupuestos"],
)


def _decimal_to_float(value: Decimal | int | float | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def _month_key(year_value: object, month_value: object) -> str:
    year = int(year_value)
    month = int(month_value)
    return f"{year:04d}-{month:02d}"


def _empty_month_values(months: list[str]) -> dict[str, dict]:
    return {
        month: {
            "ingresos": 0.0,
            "egresos": 0.0,
            "real_ingresos": 0.0,
            "real_egresos": 0.0,
            "empleados": 0.0,
            "presupuesto_id": None,
            "record_count": 0,
        }
        for month in months
    }


def _add_month_values(
    target: dict[str, dict],
    month: str,
    ingresos: Decimal | int | float | None,
    egresos: Decimal | int | float | None,
    real_ingresos: Decimal | int | float | None,
    real_egresos: Decimal | int | float | None,
    empleados: Decimal | int | float | None,
    presupuesto_id: int | None,
    record_count: int,
) -> None:
    if month not in target:
        target[month] = {
            "ingresos": 0.0,
            "egresos": 0.0,
            "real_ingresos": 0.0,
            "real_egresos": 0.0,
            "empleados": 0.0,
            "presupuesto_id": None,
            "record_count": 0,
        }

    target[month]["ingresos"] += _decimal_to_float(ingresos)
    target[month]["egresos"] += _decimal_to_float(egresos)
    target[month]["real_ingresos"] += _decimal_to_float(real_ingresos)
    target[month]["real_egresos"] += _decimal_to_float(real_egresos)
    target[month]["empleados"] += _decimal_to_float(empleados)
    target[month]["record_count"] += record_count

    if target[month]["record_count"] == 1 and presupuesto_id is not None:
        target[month]["presupuesto_id"] = presupuesto_id
    elif target[month]["presupuesto_id"] != presupuesto_id:
        target[month]["presupuesto_id"] = None


@erp_presupuesto_router.get("/panel")
def get_erp_presupuesto_panel(
    fecha_desde: date = Query(..., description="Primer dia del periodo"),
    fecha_hasta: date = Query(..., description="Ultimo dia del periodo"),
    estado: str = Query("02-ejecucion", description="Estado de proyecto a incluir"),
    proyecto_id: int | None = Query(None, description="Filtro opcional por proyecto"),
    session: Session = Depends(get_session),
):
    """Devuelve una vista agregada para el panel de presupuestos ERP."""
    year_expr = extract("year", ErpPresupuesto.fecha).label("year")
    month_expr = extract("month", ErpPresupuesto.fecha).label("month")
    ingresos_expr = func.coalesce(func.sum(ErpPresupuesto.ingres), 0).label("ingresos")
    egresos_expr = func.coalesce(func.sum(ErpPresupuesto.egreso), 0).label("egresos")
    real_ingresos_expr = func.coalesce(func.sum(ErpPresupuesto.real_ingreso), 0).label("real_ingresos")
    real_egresos_expr = func.coalesce(func.sum(ErpPresupuesto.real_egreso), 0).label("real_egresos")
    empleados_expr = func.coalesce(func.sum(ErpPresupuesto.obreros_cantidad), 0).label("empleados")
    presupuesto_id_expr = func.min(ErpPresupuesto.id).label("presupuesto_id")
    record_count_expr = func.count(ErpPresupuesto.id).label("record_count")

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
            year_expr,
            month_expr,
            ingresos_expr,
            egresos_expr,
            real_ingresos_expr,
            real_egresos_expr,
            empleados_expr,
            presupuesto_id_expr,
            record_count_expr,
        )
        .join(Proyecto, ErpPresupuesto.proyecto_id == Proyecto.id)
        .join(ErpCuenta, ErpPresupuesto.erp_cuenta_id == ErpCuenta.id)
        .join(ErpRubro, ErpCuenta.rubro_id == ErpRubro.id)
        .where(ErpPresupuesto.fecha >= fecha_desde)
        .where(ErpPresupuesto.fecha <= fecha_hasta)
        .where(Proyecto.estado == estado)
        .where(ErpPresupuesto.deleted_at.is_(None))
        .group_by(
            Proyecto.id,
            Proyecto.nombre,
            ErpRubro.id,
            ErpRubro.nombre,
            ErpCuenta.id,
            ErpCuenta.cod_cuenta,
            ErpCuenta.descripcion,
            ErpCuenta.nro_cuenta,
            year_expr,
            month_expr,
        )
        .order_by(Proyecto.nombre, ErpRubro.nombre, ErpCuenta.nro_cuenta, ErpCuenta.cod_cuenta)
    )

    if proyecto_id is not None:
        stmt = stmt.where(Proyecto.id == proyecto_id)

    rows = session.exec(stmt).all()

    months: list[str] = []
    cursor = date(fecha_desde.year, fecha_desde.month, 1)
    end_cursor = date(fecha_hasta.year, fecha_hasta.month, 1)
    while cursor <= end_cursor:
        months.append(f"{cursor.year:04d}-{cursor.month:02d}")
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)

    projects: dict[int, dict] = {}
    rubros_by_project: dict[int, dict[int, dict]] = defaultdict(dict)
    cuentas_by_rubro: dict[tuple[int, int], dict[int, dict]] = defaultdict(dict)

    for row in rows:
        month = _month_key(row.year, row.month)
        project = projects.get(row.proyecto_id)
        if project is None:
            project = {
                "proyecto_id": row.proyecto_id,
                "proyecto_nombre": row.proyecto_nombre,
                "months": _empty_month_values(months),
                "rubros": [],
            }
            projects[row.proyecto_id] = project

        rubro = rubros_by_project[row.proyecto_id].get(row.rubro_id)
        if rubro is None:
            rubro = {
                "rubro_id": row.rubro_id,
                "rubro_nombre": row.rubro_nombre,
                "months": _empty_month_values(months),
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
                "cuenta_nombre": row.cuenta_nombre,
                "months": _empty_month_values(months),
            }
            cuentas_by_rubro[cuenta_key][row.cuenta_id] = cuenta
            rubro["cuentas"].append(cuenta)

        record_count = int(row.record_count or 0)
        _add_month_values(
            project["months"],
            month,
            row.ingresos,
            row.egresos,
            row.real_ingresos,
            row.real_egresos,
            row.empleados,
            row.presupuesto_id,
            record_count,
        )
        _add_month_values(
            rubro["months"],
            month,
            row.ingresos,
            row.egresos,
            row.real_ingresos,
            row.real_egresos,
            row.empleados,
            row.presupuesto_id,
            record_count,
        )
        _add_month_values(
            cuenta["months"],
            month,
            row.ingresos,
            row.egresos,
            row.real_ingresos,
            row.real_egresos,
            row.empleados,
            row.presupuesto_id,
            record_count,
        )

    return {
        "fecha_desde": fecha_desde.isoformat(),
        "fecha_hasta": fecha_hasta.isoformat(),
        "estado": estado,
        "months": months,
        "rows": list(projects.values()),
    }
