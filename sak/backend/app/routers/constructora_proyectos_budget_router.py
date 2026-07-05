from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import Depends, Query
from sqlalchemy import extract, func
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.constructora.proyectos_budget import ProyectosBudget
from app.models.constructora.proyectos_conceptos import ProyectosConceptos
from app.models.constructora.proyectos_macrorubros import ProyectosMacrorubros

constructora_proyectos_budget_crud = GenericCRUD(ProyectosBudget)

constructora_proyectos_budget_router = create_generic_router(
    model=ProyectosBudget,
    crud=constructora_proyectos_budget_crud,
    prefix="/constructora/proyectos-budget",
    tags=["constructora-proyectos-budget"],
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
            "importe_neto": 0.0,
            "empleados": 0.0,
            "budget_id": None,
            "record_count": 0,
        }
        for month in months
    }


def _add_month_values(
    target: dict[str, dict],
    month: str,
    importe_neto: Decimal | int | float | None,
    empleados: Decimal | int | float | None,
    budget_id: int | None,
    record_count: int,
) -> None:
    if month not in target:
        target[month] = {
            "importe_neto": 0.0,
            "empleados": 0.0,
            "budget_id": None,
            "record_count": 0,
        }
    target[month]["importe_neto"] += _decimal_to_float(importe_neto)
    target[month]["empleados"] += _decimal_to_float(empleados)
    target[month]["record_count"] += record_count

    if target[month]["record_count"] == 1 and budget_id is not None:
        target[month]["budget_id"] = budget_id
    elif target[month]["budget_id"] != budget_id:
        target[month]["budget_id"] = None


def _apply_concept_sign(
    importe: Decimal | int | float | None,
    signo: int | None,
) -> float:
    value = _decimal_to_float(importe)
    return -abs(value) if int(signo or 1) < 0 else abs(value)


@constructora_proyectos_budget_router.get("/panel")
def get_proyectos_budget_panel(
    fecha_desde: date = Query(..., description="Primer dia del periodo"),
    fecha_hasta: date = Query(..., description="Ultimo dia del periodo"),
    estado: str = Query("02-ejecucion", description="Estado de proyecto a incluir"),
    proyecto_id: int | None = Query(None, description="Filtro opcional por proyecto"),
    session: Session = Depends(get_session),
):
    """
    Devuelve una vista agregada para el panel de budget.

    La metrica importe_neto aplica el signo del concepto:
    ingresos positivos, egresos negativos.
    """
    year_expr = extract("year", ProyectosBudget.fecha).label("year")
    month_expr = extract("month", ProyectosBudget.fecha).label("month")
    importe_expr = func.coalesce(func.sum(ProyectosBudget.importe), 0).label("importe")
    empleados_expr = func.coalesce(func.sum(ProyectosBudget.empleados), 0).label("empleados")
    budget_id_expr = func.min(ProyectosBudget.id).label("budget_id")
    record_count_expr = func.count(ProyectosBudget.id).label("record_count")

    stmt = (
        select(
            Proyecto.id.label("proyecto_id"),
            Proyecto.nombre.label("proyecto_nombre"),
            ProyectosConceptos.id.label("concepto_id"),
            ProyectosConceptos.nombre.label("concepto_nombre"),
            ProyectosConceptos.signo.label("concepto_signo"),
            ProyectosMacrorubros.id.label("macrorubro_id"),
            ProyectosMacrorubros.nombre.label("macrorubro_nombre"),
            year_expr,
            month_expr,
            importe_expr,
            empleados_expr,
            budget_id_expr,
            record_count_expr,
        )
        .join(Proyecto, ProyectosBudget.proyecto_id == Proyecto.id)
        .join(
            ProyectosConceptos,
            ProyectosBudget.proyectos_concepto_id == ProyectosConceptos.id,
        )
        .join(
            ProyectosMacrorubros,
            ProyectosBudget.proyectos_macrorubro_id == ProyectosMacrorubros.id,
        )
        .where(ProyectosBudget.fecha >= fecha_desde)
        .where(ProyectosBudget.fecha <= fecha_hasta)
        .where(Proyecto.estado == estado)
        .where(ProyectosBudget.deleted_at.is_(None))
        .group_by(
            Proyecto.id,
            Proyecto.nombre,
            ProyectosConceptos.id,
            ProyectosConceptos.nombre,
            ProyectosConceptos.signo,
            ProyectosMacrorubros.id,
            ProyectosMacrorubros.nombre,
            year_expr,
            month_expr,
        )
        .order_by(Proyecto.nombre, ProyectosConceptos.nombre, ProyectosMacrorubros.nombre)
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
    concepts_by_project: dict[int, dict[int, dict]] = defaultdict(dict)
    macros_by_concept: dict[tuple[int, int], dict[int, dict]] = defaultdict(dict)

    for row in rows:
        month = _month_key(row.year, row.month)
        importe_neto = _apply_concept_sign(row.importe, row.concepto_signo)
        project = projects.get(row.proyecto_id)
        if project is None:
            project = {
                "proyecto_id": row.proyecto_id,
                "proyecto_nombre": row.proyecto_nombre,
                "months": _empty_month_values(months),
                "conceptos": [],
            }
            projects[row.proyecto_id] = project

        concept = concepts_by_project[row.proyecto_id].get(row.concepto_id)
        if concept is None:
            concept = {
                "concepto_id": row.concepto_id,
                "concepto_nombre": row.concepto_nombre,
                "months": _empty_month_values(months),
                "macrorubros": [],
            }
            concepts_by_project[row.proyecto_id][row.concepto_id] = concept
            project["conceptos"].append(concept)

        macro_key = (row.proyecto_id, row.concepto_id)
        macro = macros_by_concept[macro_key].get(row.macrorubro_id)
        if macro is None:
            macro = {
                "macrorubro_id": row.macrorubro_id,
                "macrorubro_nombre": row.macrorubro_nombre,
                "months": _empty_month_values(months),
            }
            macros_by_concept[macro_key][row.macrorubro_id] = macro
            concept["macrorubros"].append(macro)

        record_count = int(row.record_count or 0)
        _add_month_values(
            project["months"],
            month,
            importe_neto,
            row.empleados,
            row.budget_id,
            record_count,
        )
        _add_month_values(
            concept["months"],
            month,
            importe_neto,
            row.empleados,
            row.budget_id,
            record_count,
        )
        _add_month_values(
            macro["months"],
            month,
            importe_neto,
            row.empleados,
            row.budget_id,
            record_count,
        )

    return {
        "fecha_desde": fecha_desde.isoformat(),
        "fecha_hasta": fecha_hasta.isoformat(),
        "estado": estado,
        "months": months,
        "rows": list(projects.values()),
    }
