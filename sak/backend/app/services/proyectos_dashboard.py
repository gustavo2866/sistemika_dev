from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.proyecto import Proyecto
from app.models.proyecto_avance import ProyectoAvance
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.compras import PoOrder, PoOrderStatus
from app.models.tipo_solicitud import TipoSolicitud
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders
from app.models.crm import CRMEvento, CRMMensaje
from app.models.enums import EstadoEvento, EstadoMensaje, TipoMensaje

# Estados considerados activos para proyectos
ACTIVE_PROJECT_STATES = ("01-plan", "02-ejecucion", "03-conclusion")
COMPLETED_PROJECT_STATES = ("04-terminados",)
COMPLETED_PROJECT_STATES = ("04-terminados",)

# Clasificación de tipos de solicitud (hardcoded por ahora)
# TODO: En el futuro, mover esta lógica a un atributo tipo_costo en TipoSolicitud
TIPO_SOLICITUD_MO_PROPIOS = [7]  # IDs de tipos MO-Propios
TIPO_SOLICITUD_SERVICIOS = [3, 5, 6]  # IDs de tipos Servicios, Transporte, Mensajería (mo-terceros)
TIPO_SOLICITUD_MATERIALES = [1, 2, 4]  # IDs de tipos Materiales, Ferretería, Insumos (materiales)

# Mapa para clasificación configurable (preparación para futuro)
TIPO_COSTO_MAP = {
    "mo_propia": TIPO_SOLICITUD_MO_PROPIOS,
    "mo_terceros": TIPO_SOLICITUD_SERVICIOS, 
    "materiales": TIPO_SOLICITUD_MATERIALES,
}


@dataclass
class CalculatedProyecto:
    """Wrapper con datos calculados para dashboard de proyectos.
    
    - Totales: dataset filtrado según reglas del periodo.
    - Nuevos: proyectos cuya creación ocurrió dentro del periodo.
    - Completados: proyectos finalizados dentro del rango.
    - Activos: proyectos en estados activos al corte.
    """

    proyecto: Proyecto
    fecha_creacion: date
    fecha_inicio: Optional[date]
    fecha_final: Optional[date]
    fecha_ultimo_avance: Optional[date]
    estado_al_corte: str
    avance_total: Decimal
    importe_ejecutado: Optional[Decimal]
    presupuesto_total: Optional[Decimal]
    costo_ejecutado: Optional[Decimal]  # 🚀 NUEVO: Costo ejecutado pre-calculado
    horas_trabajadas: int
    es_activo: bool
    es_completado: bool
    es_completado_periodo: bool
    es_nuevo_periodo: bool
    bucket_creacion: str
    bucket_inicio: Optional[str]
    bucket_ultimo_avance: Optional[str]
    dias_ejecucion: int


def _to_date(value: str | date | datetime | None) -> date:
    if value is None:
        raise ValueError("Fecha requerida")
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_date(value: Optional[datetime]) -> Optional[date]:
    if value is None:
        return None
    return value.date()


def _month_bucket(value: date | None) -> Optional[str]:
    if not value:
        return None
    return f"{value.year}-{value.month:02d}"


def _decimal(value: Optional[Decimal | float | int]) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _sum_amount(values: Iterable[Optional[Decimal]]) -> Decimal:
    total = Decimal("0")
    for value in values:
        if value is None:
            continue
        total += value
    return total


def _diff_days(end: date, start: date) -> int:
    return max(0, (end - start).days)


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _shift_month(base: date, months: int) -> date:
    month = base.month - 1 + months
    year = base.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _month_end(value: date) -> date:
    next_month = _shift_month(value, 1)
    return next_month - timedelta(days=1)


def _get_periods_by_type(end_date: date, periodo_tipo: str = "mensual") -> List[Tuple[date, date]]:
    """Obtiene los últimos 4 períodos según el tipo especificado"""
    periods = []
    
    if periodo_tipo == "mensual":
        # Período actual (mes de end_date)
        current_start = _month_start(end_date)
        periods.append((current_start, end_date))
        
        # Últimos 3 períodos completos
        for i in range(1, 4):
            period_start = _month_start(_shift_month(end_date, -i))
            period_end = _month_end(_shift_month(end_date, -i))
            periods.append((period_start, period_end))
            
    elif periodo_tipo == "trimestral":
        # Período actual (trimestre de end_date)
        current_quarter_start = _quarter_start(end_date)
        periods.append((current_quarter_start, end_date))
        
        # Últimos 3 trimestres completos
        for i in range(1, 4):
            quarter_start = _shift_quarter(end_date, -i)
            quarter_end = _quarter_end(_shift_quarter(end_date, -i))
            periods.append((quarter_start, quarter_end))
            
    elif periodo_tipo == "semestral":
        # Período actual (semestre de end_date)
        current_semester_start = _semester_start(end_date)
        periods.append((current_semester_start, end_date))
        
        # Últimos 3 semestres completos
        for i in range(1, 4):
            semester_start = _shift_semester(end_date, -i)
            semester_end = _semester_end(_shift_semester(end_date, -i))
            periods.append((semester_start, semester_end))
            
    elif periodo_tipo == "anual":
        # Período actual (año de end_date)
        current_year_start = _year_start(end_date)
        periods.append((current_year_start, end_date))
        
        # Últimos 3 años completos
        for i in range(1, 4):
            year_start = _shift_year(end_date, -i)
            year_end = _year_end(_shift_year(end_date, -i))
            periods.append((year_start, year_end))
    
    return periods


def _quarter_start(value: date) -> date:
    """Inicio del trimestre"""
    quarter = (value.month - 1) // 3 + 1
    month = (quarter - 1) * 3 + 1
    return date(value.year, month, 1)


def _quarter_end(value: date) -> date:
    """Fin del trimestre"""
    quarter = (value.month - 1) // 3 + 1
    month = quarter * 3
    return _month_end(date(value.year, month, 1))


def _shift_quarter(base: date, quarters: int) -> date:
    """Desplaza trimestres"""
    month = base.month - 1 + (quarters * 3)
    year = base.year + month // 12
    month = month % 12 + 1
    quarter = (month - 1) // 3 + 1
    month = (quarter - 1) * 3 + 1
    return date(year, month, 1)


def _semester_start(value: date) -> date:
    """Inicio del semestre"""
    semester = 1 if value.month <= 6 else 2
    month = 1 if semester == 1 else 7
    return date(value.year, month, 1)


def _semester_end(value: date) -> date:
    """Fin del semestre"""
    semester = 1 if value.month <= 6 else 2
    month = 6 if semester == 1 else 12
    return _month_end(date(value.year, month, 1))


def _shift_semester(base: date, semesters: int) -> date:
    """Desplaza semestres"""
    total_months = (base.year * 12 + base.month - 1) + (semesters * 6)
    year = total_months // 12
    month = (total_months % 12) + 1
    semester = 1 if month <= 6 else 2
    month = 1 if semester == 1 else 7
    return date(year, month, 1)


def _year_start(value: date) -> date:
    """Inicio del año"""
    return date(value.year, 1, 1)


def _year_end(value: date) -> date:
    """Fin del año"""
    return date(value.year, 12, 31)


def _shift_year(base: date, years: int) -> date:
    """Desplaza años"""
    return date(base.year + years, 1, 1)


def _calculate_presupuestado_kpis(
    session: Session,
    proyectos_ids: List[int],
    periods: List[Tuple[date, date]],
    periodo_tipo: str = "mensual"
) -> Dict:
    """NUEVA ESTRATEGIA: Calcula KPIs presupuestados con 1 query optimizado"""

    if not proyectos_ids:
        return {
            "materiales": 0.0,
            "mo_propia": 0.0,
            "mo_terceros": 0.0,
            "importe": 0.0,
            "horas": 0.0,
            "metros": 0.0,
            "por_periodo": [],
        }
    
    # PASO 1: presupuesto_detalle (UNA SOLA QUERY)
    stmt = select(
        ProyPresupuesto.proyecto_id,
        ProyPresupuesto.mo_propia,
        ProyPresupuesto.mo_terceros,
        ProyPresupuesto.materiales,
        ProyPresupuesto.fecha,
        Proyecto.estado
    ).select_from(
        ProyPresupuesto
    ).join(
        Proyecto, ProyPresupuesto.proyecto_id == Proyecto.id
    ).where(
        ProyPresupuesto.proyecto_id.in_(proyectos_ids)
    )
    
    presupuesto_detalle = session.exec(stmt).all()
    
    # PASO 2: presupuesto_periodo (PROCESAMIENTO EN PYTHON - SUPER RÁPIDO)
    kpis = {
        "materiales": 0.0,
        "mo_propia": 0.0,
        "mo_terceros": 0.0,
        "importe": 0.0,
        "horas": 0.0,
        "metros": 0.0,
        "por_periodo": []
    }
    
    # Procesar por período en Python (más rápido que SQL)
    for period_start, period_end in periods:
        # Filtrar en memoria (instantáneo)
        periodo_data = [
            row for row in presupuesto_detalle
            if period_start <= row.fecha <= period_end
        ]
        
        # Sumar en Python (super rápido)
        materiales_periodo = sum(row.materiales or 0 for row in periodo_data)
        mo_propia_periodo = sum(row.mo_propia or 0 for row in periodo_data)
        mo_terceros_periodo = sum(row.mo_terceros or 0 for row in periodo_data)
        importe_periodo = materiales_periodo + mo_propia_periodo + mo_terceros_periodo
        
        # Acumular totales
        kpis["materiales"] += float(materiales_periodo)
        kpis["mo_propia"] += float(mo_propia_periodo)
        kpis["mo_terceros"] += float(mo_terceros_periodo)
        kpis["importe"] += float(importe_periodo)
        
        # Detalle por período
        kpis["por_periodo"].append({
            "periodo": f"{period_start.strftime('%Y-%m')}",
            "materiales": float(materiales_periodo),
            "mo_propia": float(mo_propia_periodo),
            "mo_terceros": float(mo_terceros_periodo),
            "importe": float(importe_periodo),
            "horas": 0.0,  # No disponible en presupuesto
            "metros": 0.0,  # No disponible en presupuesto
        })
    
    return kpis
    kpis["metros"] = float(kpis["metros"])
    
    return kpis


def _calculate_real_kpis(
    session: Session,
    proyectos_ids: List[int],
    periods: List[Tuple[date, date]],
    periodo_tipo: str = "mensual"
) -> Dict:
    """NUEVA ESTRATEGIA: Calcula KPIs reales con 2 queries optimizados"""

    if not proyectos_ids:
        return {
            "materiales": 0.0,
            "mo_propia": 0.0,
            "mo_terceros": 0.0,
            "importe": 0.0,
            "horas": 0.0,
            "superficie": 0.0,
            "por_periodo": [],
        }
    
    # PASO 4: real_costo_detalle (UNA SOLA QUERY usando vista optimizada)
    stmt_ordenes = select(
        VwKpisProyectosPoOrders.proyecto_id,
        VwKpisProyectosPoOrders.fecha_emision,
        VwKpisProyectosPoOrders.concepto_proyecto,
        VwKpisProyectosPoOrders.importe
    ).select_from(
        VwKpisProyectosPoOrders
    ).join(
        Proyecto, VwKpisProyectosPoOrders.proyecto_id == Proyecto.id
    ).where(
        VwKpisProyectosPoOrders.proyecto_id.in_(proyectos_ids)
    )
    
    real_costo_detalle = session.exec(stmt_ordenes).all()
    
    # PASO 7: ingreso_periodo (UNA SOLA QUERY)
    stmt_avances = select(
        ProyectoAvance.proyecto_id,
        ProyectoAvance.fecha_registracion,
        ProyectoAvance.importe,
        ProyectoAvance.horas
    ).select_from(
        ProyectoAvance
    ).join(
        Proyecto, ProyectoAvance.proyecto_id == Proyecto.id
    ).where(
        ProyectoAvance.proyecto_id.in_(proyectos_ids)
    )
    
    ingreso_detalle = session.exec(stmt_avances).all()
    
    # PASO 5 y 7: Procesamiento en Python (SUPER RÁPIDO)
    # Estructura similar a presupuestado: nivel 1 = totales, nivel 2 = períodos
    kpis = {
        "materiales": 0.0,
        "mo_propia": 0.0,
        "mo_terceros": 0.0,
        "importe": 0.0,
        "horas": 0.0,
        "superficie": 0.0,
        "por_periodo": []
    }
    
    for period_start, period_end in periods:
        # Filtrar costos reales del período
        costos_periodo = [
            row for row in real_costo_detalle
            if period_start <= row.fecha_emision <= period_end
        ]
        
        # Agrupar por concepto en Python (instantáneo)
        materiales_periodo = sum(
            row.importe for row in costos_periodo 
            if row.concepto_proyecto == 'materiales'
        )
        mo_propia_periodo = sum(
            row.importe for row in costos_periodo 
            if row.concepto_proyecto == 'mo_propia'
        )
        mo_terceros_periodo = sum(
            row.importe for row in costos_periodo 
            if row.concepto_proyecto == 'mo_terceros'
        )
        
        # Filtrar ingresos del período
        ingresos_periodo = [
            row for row in ingreso_detalle
            if period_start <= row.fecha_registracion <= period_end
        ]
        
        # Sumar ingresos y horas por período
        importe_periodo = sum(row.importe or 0 for row in ingresos_periodo)
        horas_periodo = sum(row.horas or 0 for row in ingresos_periodo)
        
        # NIVEL 1: Acumular totales consolidados
        kpis["materiales"] += float(materiales_periodo)
        kpis["mo_propia"] += float(mo_propia_periodo)
        kpis["mo_terceros"] += float(mo_terceros_periodo)
        kpis["importe"] += float(importe_periodo)
        kpis["horas"] += float(horas_periodo)
        
        # NIVEL 2: Detalle por período (estructura similar a presupuestado)
        kpis["por_periodo"].append({
            "periodo": f"{period_start.strftime('%Y-%m')}",
            "materiales": float(materiales_periodo),
            "mo_propia": float(mo_propia_periodo),
            "mo_terceros": float(mo_terceros_periodo),
            "importe": float(importe_periodo),
            "horas": float(horas_periodo),
            "superficie": 0.0,  # Se calcula en totales si es necesario
        })
    
    return kpis


def _calculate_presupuesto_total_kpis(
    session: Session,
    proyectos_ids: List[int]
) -> Dict:
    """PASO 3: presupuesto_total - Reutiliza presupuesto_detalle sin filtro de fecha"""

    if not proyectos_ids:
        return {
            "materiales": 0.0,
            "mo_propia": 0.0,
            "mo_terceros": 0.0,
            "importe": 0.0,
            "horas": 0.0,
            "metros": 0.0,
        }
    
    # Reutilizar la misma query del PASO 1 pero sin filtros de período
    stmt = select(
        ProyPresupuesto.mo_propia,
        ProyPresupuesto.mo_terceros,
        ProyPresupuesto.materiales
    ).select_from(
        ProyPresupuesto
    ).join(
        Proyecto, ProyPresupuesto.proyecto_id == Proyecto.id
    ).where(
        ProyPresupuesto.proyecto_id.in_(proyectos_ids)
    )
    
    presupuesto_total_detalle = session.exec(stmt).all()
    
    # Procesamiento en Python (instantáneo)
    kpis = {
        "materiales": float(sum(row.materiales or 0 for row in presupuesto_total_detalle)),
        "mo_propia": float(sum(row.mo_propia or 0 for row in presupuesto_total_detalle)),
        "mo_terceros": float(sum(row.mo_terceros or 0 for row in presupuesto_total_detalle)),
    }
    
    kpis["importe"] = kpis["materiales"] + kpis["mo_propia"] + kpis["mo_terceros"]
    kpis["horas"] = 0.0  # No disponible en presupuesto
    kpis["metros"] = 0.0  # No disponible en presupuesto
    
    return kpis


def _calculate_real_total_kpis(
    session: Session,
    proyectos_ids: List[int],
    end_date: date
) -> Dict:
    """PASOS 6 y 8: real_costo_total + ingreso_total hasta fecha límite"""
    
    if not proyectos_ids:
        return {
            "materiales": 0.0,
            "mo_propia": 0.0,
            "mo_terceros": 0.0,
            "importe": 0.0,
            "horas": 0.0,
            "superficie": 0.0,
        }

    # PASO 6: real_costo_total (reutiliza real_costo_detalle con filtro hasta end_date)
    stmt_ordenes = select(
        VwKpisProyectosPoOrders.concepto_proyecto,
        VwKpisProyectosPoOrders.importe
    ).select_from(
        VwKpisProyectosPoOrders
    ).join(
        Proyecto, VwKpisProyectosPoOrders.proyecto_id == Proyecto.id
    ).where(
        VwKpisProyectosPoOrders.proyecto_id.in_(proyectos_ids),
        VwKpisProyectosPoOrders.fecha_emision <= end_date  # Hasta fecha límite
    )
    
    real_costo_total = session.exec(stmt_ordenes).all()
    
    # PASO 8: ingreso_total (reutiliza ingreso_detalle con filtro hasta end_date)
    stmt_avances = select(
        ProyectoAvance.importe,
        ProyectoAvance.horas
    ).select_from(
        ProyectoAvance
    ).join(
        Proyecto, ProyectoAvance.proyecto_id == Proyecto.id
    ).where(
        ProyectoAvance.proyecto_id.in_(proyectos_ids),
        ProyectoAvance.fecha_registracion <= end_date  # Hasta fecha límite
    )
    
    ingreso_total = session.exec(stmt_avances).all()
    
    # Procesamiento en Python (instantáneo)
    kpis = {
        "materiales": float(sum(
            row.importe for row in real_costo_total 
            if row.concepto_proyecto == 'materiales'
        )),
        "mo_propia": float(sum(
            row.importe for row in real_costo_total 
            if row.concepto_proyecto == 'mo_propia'
        )),
        "mo_terceros": float(sum(
            row.importe for row in real_costo_total 
            if row.concepto_proyecto == 'mo_terceros'
        )),
        "importe": float(sum(row.importe or 0 for row in ingreso_total)),
        "horas": float(sum(row.horas or 0 for row in ingreso_total)),
        "superficie": 0.0,  # Se podría calcular si es necesario
    }
    
    return kpis
    
    kpis["mo_propia"] += mo_propia_total
    kpis["mo_terceros"] += mo_terceros_total 
    kpis["materiales"] += materiales_total
    
    # Convertir totales a float
    kpis["materiales"] = float(kpis["materiales"])
    kpis["mo_propia"] = float(kpis["mo_propia"])
    kpis["mo_terceros"] = float(kpis["mo_terceros"])
    kpis["importe"] = float(kpis["importe"])
    kpis["horas"] = float(kpis["horas"])
    kpis["superficie"] = float(kpis["superficie"])
    
    return kpis


# ESTRATEGIA BATCH SIMPLIFICADA 🚀 (Pragmática y eficiente)
def fetch_proyectos_optimized_single_query(
    session: Session,
    start_date: str,
    end_date: str,
    proyecto_ids: Optional[List[int]] = None,
    responsable_ids: Optional[List[int]] = None,
    estado_ids: Optional[List[str]] = None,
    centro_costo_ids: Optional[List[int]] = None,
    limit: Optional[int] = 15,
) -> List[Tuple[Proyecto, Decimal, Decimal]]:
    """
    🚀 ESTRATEGIA BATCH SIMPLIFICADA: Query principal + 2 batch queries eficientes
    
    Returns: List[Tuple[Proyecto, presupuesto_total, costo_ejecutado]]
    """
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info("🚀 BATCH OPTIMIZADO: Ejecutando estrategia batch simplificada")
    
    # 1. Query principal para proyectos (rápida con LIMIT)
    stmt = select(Proyecto).options(selectinload(Proyecto.avances))
    
    # Aplicar filtros
    if proyecto_ids:
        stmt = stmt.where(Proyecto.id.in_(proyecto_ids))

    if responsable_ids:
        stmt = stmt.where(Proyecto.responsable_id.in_(responsable_ids))
    
    if estado_ids:
        stmt = stmt.where(Proyecto.estado.in_(estado_ids))
        
    if centro_costo_ids:
        stmt = stmt.where(Proyecto.centro_costo.in_(centro_costo_ids))
    
    stmt = stmt.order_by(Proyecto.created_at.desc())
    if limit:
        stmt = stmt.limit(limit)
    
    proyectos = session.exec(stmt).all()
    
    if not proyectos:
        return []
    
    proyecto_ids = [p.id for p in proyectos]
    
    # 2. Batch query para presupuestos (1 query para todos)
    logger.info(f"📊 BATCH: Calculando presupuestos para {len(proyecto_ids)} proyectos")
    presupuesto_stmt = select(
        ProyPresupuesto.proyecto_id,
        func.sum(
            ProyPresupuesto.mo_propia + 
            ProyPresupuesto.mo_terceros + 
            ProyPresupuesto.materiales
        ).label('presupuesto_total')
    ).where(ProyPresupuesto.proyecto_id.in_(proyecto_ids)).group_by(ProyPresupuesto.proyecto_id)
    
    presupuestos_dict = {
        row.proyecto_id: Decimal(str(row.presupuesto_total or 0)) 
        for row in session.exec(presupuesto_stmt).all()
    }
    
    # 3. Batch query para costos ejecutados (1 query para todos)
    oportunidad_ids = [p.oportunidad_id for p in proyectos if p.oportunidad_id is not None]
    
    costos_dict = {}
    if oportunidad_ids:
        logger.info(f"💰 BATCH: Calculando costos para {len(oportunidad_ids)} oportunidades")
        costos_dict = _calculate_batch_costo_ejecutado(session, oportunidad_ids)
    
    # 4. Combinar resultados
    results = []
    for proyecto in proyectos:
        presupuesto = presupuestos_dict.get(proyecto.id, Decimal("0"))
        costo = costos_dict.get(proyecto.oportunidad_id, Decimal("0"))
        results.append((proyecto, presupuesto, costo))
    
    logger.info(f"🎯 BATCH RESULT: {len(results)} proyectos con datos completos")
    
    return results


def fetch_proyectos_for_dashboard_optimized(
    session: Session,
    start_date: str,
    end_date: str,
    proyecto_ids: Optional[List[int]] = None,
    responsable_ids: Optional[List[int]] = None,
    estado_ids: Optional[List[str]] = None,
    centro_costo_ids: Optional[List[int]] = None,
) -> List[CalculatedProyecto]:
    """
    🚀 VERSIÓN OPTIMIZADA que usa single query con JOINs
    Mantiene la misma interfaz que fetch_proyectos_for_dashboard pero usa consulta optimizada
    """
    
    # Usar la nueva función optimizada
    optimized_results = fetch_proyectos_optimized_single_query(
        session=session,
        start_date=start_date,
        end_date=end_date,
        proyecto_ids=proyecto_ids,
        responsable_ids=responsable_ids,
        estado_ids=estado_ids,  
        centro_costo_ids=centro_costo_ids,
        limit=15
    )
    
    start = _to_date(start_date)
    end = _to_date(end_date)
    
    calculated_proyectos = []
    
    for proyecto, presupuesto_total, costo_ejecutado in optimized_results:
        # Construir CalculatedProyecto con datos pre-calculados
        calculated_proyecto = _build_calculated_proyecto(
            proyecto=proyecto, 
            start_date=start, 
            end_date=end,
            presupuesto_precalculado=presupuesto_total,
            costo_ejecutado_precalculado=costo_ejecutado
        )
        calculated_proyectos.append(calculated_proyecto)
    
    return calculated_proyectos


def _build_calculated_proyecto(
    proyecto: Proyecto, 
    start_date: date, 
    end_date: date,
    presupuesto_precalculado: Optional[Decimal] = None,
    costo_ejecutado_precalculado: Optional[Decimal] = None
) -> CalculatedProyecto:
    """
    🚀 HELPER: Construye CalculatedProyecto usando valores pre-calculados para optimización
    """
    
    # Usar presupuesto pre-calculado o calcular si es necesario
    presupuesto_total = presupuesto_precalculado or Decimal("0")
    
    # Calcular métricas de avances (esto sigue siendo necesario)
    avances = proyecto.avances or []
    if avances:
        avance_total = max(a.avance for a in avances)
        ultimo_avance_fecha = max(a.fecha_registracion for a in avances)
        importe_ejecutado = sum(a.importe for a in avances)
        horas_trabajadas = sum(a.horas for a in avances)
    else:
        avance_total = Decimal("0")
        ultimo_avance_fecha = None
        importe_ejecutado = Decimal("0")
        horas_trabajadas = 0
    
    # Fechas relevantes
    fecha_creacion = _parse_date(proyecto.created_at) or datetime.now().date()
    fecha_inicio = proyecto.fecha_inicio
    fecha_final = proyecto.fecha_final
    
    # Estados y flags
    estado_al_corte = proyecto.estado or "SIN_ESTADO"
    es_activo = estado_al_corte in ACTIVE_PROJECT_STATES
    es_completado = (
        avance_total >= Decimal("100")
        or estado_al_corte in COMPLETED_PROJECT_STATES
    )
    
    # Flags de período
    es_nuevo_periodo = start_date <= fecha_creacion <= end_date
    es_completado_periodo = (
        es_completado and 
        ultimo_avance_fecha and 
        start_date <= ultimo_avance_fecha <= end_date
    )
    
    # Buckets temporales
    bucket_creacion = _month_bucket(fecha_creacion)
    bucket_inicio = _month_bucket(fecha_inicio)
    bucket_ultimo_avance = _month_bucket(ultimo_avance_fecha)
    
    # Días de ejecución
    if fecha_inicio:
        fecha_ref = ultimo_avance_fecha or datetime.now().date()
        dias_ejecucion = _diff_days(fecha_ref, fecha_inicio)
    else:
        dias_ejecucion = 0
    
    return CalculatedProyecto(
        proyecto=proyecto,
        fecha_creacion=fecha_creacion,
        fecha_inicio=fecha_inicio,
        fecha_final=fecha_final,
        fecha_ultimo_avance=ultimo_avance_fecha,
        estado_al_corte=estado_al_corte,
        avance_total=avance_total,
        importe_ejecutado=importe_ejecutado,
        presupuesto_total=presupuesto_total,
        costo_ejecutado=costo_ejecutado_precalculado,  # 🚀 NUEVO: Incluir costo pre-calculado
        horas_trabajadas=horas_trabajadas,
        es_activo=es_activo,
        es_completado=es_completado,
        es_completado_periodo=es_completado_periodo,
        es_nuevo_periodo=es_nuevo_periodo,
        bucket_creacion=bucket_creacion,
        bucket_inicio=bucket_inicio,
        bucket_ultimo_avance=bucket_ultimo_avance,
        dias_ejecucion=dias_ejecucion,
    )


def fetch_proyectos_for_dashboard(
    session: Session,
    start_date: str,
    end_date: str,
    responsable_ids: Optional[List[int]] = None,
    estado_ids: Optional[List[str]] = None,
    centro_costo_ids: Optional[List[int]] = None,
) -> List[CalculatedProyecto]:
    """Obtiene proyectos con cálculos para el dashboard"""
    
    stmt = select(Proyecto).options(
        selectinload(Proyecto.avances),
    )
    
    # Aplicar filtros
    if responsable_ids:
        stmt = stmt.where(Proyecto.responsable_id.in_(responsable_ids))
    
    if estado_ids:
        stmt = stmt.where(Proyecto.estado.in_(estado_ids))
        
    if centro_costo_ids:
        stmt = stmt.where(Proyecto.centro_costo.in_(centro_costo_ids))
    
    # OPTIMIZACIÓN CRÍTICA: Ordenar por relevancia y limitar para performance
    stmt = stmt.order_by(Proyecto.created_at.desc()).limit(15)
    
    proyectos = session.exec(stmt).all()
    
    # OPTIMIZACIÓN: Consulta batch de presupuestos para evitar N+1
    proyecto_ids = [p.id for p in proyectos]
    presupuesto_stmt = select(
        ProyPresupuesto.proyecto_id,
        func.sum(
            ProyPresupuesto.mo_propia + 
            ProyPresupuesto.mo_terceros + 
            ProyPresupuesto.materiales
        ).label('presupuesto_total')
    ).where(ProyPresupuesto.proyecto_id.in_(proyecto_ids)).group_by(ProyPresupuesto.proyecto_id)
    
    presupuestos_dict = {
        row.proyecto_id: row.presupuesto_total or Decimal("0") 
        for row in session.exec(presupuesto_stmt).all()
    }
    
    start = _to_date(start_date)
    end = _to_date(end_date)
    
    calculated_proyectos = []
    
    for proyecto in proyectos:
        # OPTIMIZACIÓN: Usar presupuesto pre-calculado del batch
        presupuesto_total = presupuestos_dict.get(proyecto.id, Decimal("0"))
        
        # Calcular métricas de avances
        avances = proyecto.avances or []
        if avances:
            avance_total = max(a.avance for a in avances)
            ultimo_avance_fecha = max(a.fecha_registracion for a in avances)
            importe_ejecutado = sum(a.importe for a in avances)
            horas_trabajadas = sum(a.horas for a in avances)
        else:
            avance_total = Decimal("0")
            ultimo_avance_fecha = None
            importe_ejecutado = Decimal("0")
            horas_trabajadas = 0
        
        # Fechas relevantes
        fecha_creacion = _parse_date(proyecto.created_at) or datetime.now().date()
        fecha_inicio = proyecto.fecha_inicio
        fecha_final = proyecto.fecha_final
        
        # Estados y flags
        estado_al_corte = proyecto.estado or "SIN_ESTADO"
        es_activo = estado_al_corte in ACTIVE_PROJECT_STATES
        es_completado = (
            avance_total >= Decimal("100")
            or estado_al_corte in COMPLETED_PROJECT_STATES
        )
        
        # Flags de período
        es_nuevo_periodo = start <= fecha_creacion <= end
        es_completado_periodo = (
            es_completado and 
            ultimo_avance_fecha and 
            start <= ultimo_avance_fecha <= end
        )
        
        # Buckets temporales
        bucket_creacion = _month_bucket(fecha_creacion)
        bucket_inicio = _month_bucket(fecha_inicio)
        bucket_ultimo_avance = _month_bucket(ultimo_avance_fecha)
        
        # Días de ejecución
        if fecha_inicio:
            fecha_ref = ultimo_avance_fecha or datetime.now().date()
            dias_ejecucion = _diff_days(fecha_ref, fecha_inicio)
        else:
            dias_ejecucion = 0
        
        calculated_proyecto = CalculatedProyecto(
            proyecto=proyecto,
            fecha_creacion=fecha_creacion,
            fecha_inicio=fecha_inicio,
            fecha_final=fecha_final,
            fecha_ultimo_avance=ultimo_avance_fecha,
            estado_al_corte=estado_al_corte,
            avance_total=avance_total,
            importe_ejecutado=importe_ejecutado,
            presupuesto_total=presupuesto_total,
            costo_ejecutado=None,  # 🚀 Función legacy no calcula costo ejecutado
            horas_trabajadas=horas_trabajadas,
            es_activo=es_activo,
            es_completado=es_completado,
            es_completado_periodo=es_completado_periodo,
            es_nuevo_periodo=es_nuevo_periodo,
            bucket_creacion=bucket_creacion,
            bucket_inicio=bucket_inicio,
            bucket_ultimo_avance=bucket_ultimo_avance,
            dias_ejecucion=dias_ejecucion,
        )
        
        calculated_proyectos.append(calculated_proyecto)
    
    return calculated_proyectos


def build_proyectos_dashboard_payload(
    items: List[CalculatedProyecto],
    start_date: str,
    end_date: str,
    limit_top: int = 5,
    filters: Dict = None,
    session: Session = None,
    periodo_tipo: str = "mensual"
) -> Dict:
    """Construye el payload principal del dashboard de proyectos con nuevos KPIs"""
    
    if filters is None:
        filters = {}
    
    # ===== NUEVOS KPIs SOLICITADOS =====
    
    end_date_obj = _to_date(end_date)
    periods = _get_periods_by_type(end_date_obj, periodo_tipo)
    proyectos_ids = [item.proyecto.id for item in items]
    
    # 1. Presupuestado (últimos 3 períodos + actual)
    kpis_presupuestado = _calculate_presupuestado_kpis(session, proyectos_ids, periods, periodo_tipo)
    
    # 2. Real (últimos 3 períodos + actual)  
    kpis_real = _calculate_real_kpis(session, proyectos_ids, periods, periodo_tipo)
    
    # 3. Presupuesto total (desde inicio - TODOS los registros sin filtro de fecha)
    kpis_presupuesto_total = _calculate_presupuesto_total_kpis(session, proyectos_ids)
    
    # 4. Real total (desde inicio hasta fecha límite del período seleccionado)
    kpis_real_total = _calculate_real_total_kpis(session, proyectos_ids, end_date_obj)
    
    # 5. Alertas del dashboard
    alerts = _build_proyectos_dashboard_alerts(items, session)
    
    # PAYLOAD SOLO CON LOS 8 PASOS SOLICITADOS + ALERTAS
    payload = {
        "periodo": {"start": start_date, "end": end_date},
        "filtros": filters,
        "kpis_nuevos": {
            "presupuestado": kpis_presupuestado,
            "real": kpis_real, 
            "presupuesto_total": kpis_presupuesto_total,
            "real_total": kpis_real_total,
        },
        "alerts": alerts
    }
    
    return payload


def _build_proyectos_dashboard_alerts(
    items: List[CalculatedProyecto],
    session: Optional[Session],
) -> Dict[str, int]:
    """Construye las alertas del dashboard de proyectos usando la relación oportunidad_id"""
    
    # Obtener los oportunidad_ids de los proyectos
    oportunidad_ids = [
        item.proyecto.oportunidad_id for item in items 
        if item.proyecto.oportunidad_id is not None
    ]
    
    if not session or not oportunidad_ids:
        return {
            "mensajes": 0,
            "eventos": 0, 
            "ordenes_rechazadas": 0,
        }
    
    today = datetime.now(UTC).date()
    
    # ALERTA 1: Mensajes nuevos (sin leer) en oportunidades relacionadas
    query_mensajes = (
        select(func.count(func.distinct(CRMMensaje.oportunidad_id)))
        .select_from(CRMMensaje)
        .where(CRMMensaje.deleted_at.is_(None))
        .where(CRMMensaje.oportunidad_id.in_(oportunidad_ids))
        .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
        .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
    )
    
    # ALERTA 2: Eventos vencidos en oportunidades relacionadas  
    query_eventos = (
        select(func.count(func.distinct(CRMEvento.oportunidad_id)))
        .select_from(CRMEvento)
        .where(CRMEvento.deleted_at.is_(None))
        .where(CRMEvento.oportunidad_id.in_(oportunidad_ids))
        .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
        .where(CRMEvento.fecha_evento.is_not(None))
        .where(func.date(CRMEvento.fecha_evento) < today)
    )
    
    # ALERTA 3: Órdenes rechazadas en oportunidades relacionadas
    # Usar los estados rechazados del po_dashboard
    REJECTED_STATUS_KEYS = {"rechazada", "cancelada", "anulada"}
    
    query_ordenes = (
        select(func.count(func.distinct(PoOrder.oportunidad_id)))
        .select_from(PoOrder)
        .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
        .where(PoOrder.deleted_at.is_(None))
        .where(PoOrder.oportunidad_id.in_(oportunidad_ids))
        .where(func.lower(PoOrderStatus.nombre).in_(REJECTED_STATUS_KEYS))
    )
    
    return {
        "mensajes": int(session.exec(query_mensajes).one() or 0),
        "eventos": int(session.exec(query_eventos).one() or 0),
        "ordenes_rechazadas": int(session.exec(query_ordenes).one() or 0),
    }


def filter_proyectos_by_alert(
    proyectos: List[CalculatedProyecto],
    alert_key: str,
    session: Session,
) -> List[CalculatedProyecto]:
    """Filtra proyectos que tienen una alerta específica usando la relación oportunidad_id"""
    
    # Obtener los oportunidad_ids de los proyectos
    oportunidad_ids = [
        item.proyecto.oportunidad_id for item in proyectos 
        if item.proyecto.oportunidad_id is not None
    ]
    
    if not oportunidad_ids:
        return []
    
    today = datetime.now(UTC).date()
    
    if alert_key == "mensajes":
        query = (
            select(CRMMensaje.oportunidad_id)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id.in_(oportunidad_ids))
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
        )
        matched_ids = {item for item in session.exec(query).all() if item is not None}
        return [item for item in proyectos if item.proyecto.oportunidad_id in matched_ids]
    
    if alert_key == "eventos":
        query = (
            select(CRMEvento.oportunidad_id)
            .where(CRMEvento.deleted_at.is_(None))
            .where(CRMEvento.oportunidad_id.in_(oportunidad_ids))
            .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
            .where(CRMEvento.fecha_evento.is_not(None))
            .where(func.date(CRMEvento.fecha_evento) < today)
        )
        matched_ids = {item for item in session.exec(query).all() if item is not None}
        return [item for item in proyectos if item.proyecto.oportunidad_id in matched_ids]
    
    if alert_key == "ordenes_rechazadas":
        REJECTED_STATUS_KEYS = {"rechazada", "cancelada", "anulada"}
        query = (
            select(PoOrder.oportunidad_id)
            .select_from(PoOrder)
            .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
            .where(PoOrder.deleted_at.is_(None))
            .where(PoOrder.oportunidad_id.in_(oportunidad_ids))
            .where(func.lower(PoOrderStatus.nombre).in_(REJECTED_STATUS_KEYS))
        )
        matched_ids = {item for item in session.exec(query).all() if item is not None}
        return [item for item in proyectos if item.proyecto.oportunidad_id in matched_ids]
    
    return list(proyectos)


def check_proyecto_alert(
    proyecto_id: int,
    alert_key: str,
    session: Session,
) -> bool:
    """Devuelve True si el proyecto sigue teniendo la alerta indicada."""
    
    proyecto = session.get(Proyecto, proyecto_id)
    if proyecto is None or proyecto.deleted_at is not None:
        return False
    
    oportunidad_id = proyecto.oportunidad_id
    if oportunidad_id is None:
        return False
    
    today = datetime.now(UTC).date()
    
    if alert_key == "mensajes":
        count = session.exec(
            select(func.count(CRMMensaje.id))
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
        ).one()
        return int(count or 0) > 0
    
    if alert_key == "eventos":
        count = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.deleted_at.is_(None))
            .where(CRMEvento.oportunidad_id == oportunidad_id)
            .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
            .where(CRMEvento.fecha_evento.is_not(None))
            .where(func.date(CRMEvento.fecha_evento) < today)
        ).one()
        return int(count or 0) > 0
    
    if alert_key == "ordenes_rechazadas":
        REJECTED_STATUS_KEYS = {"rechazada", "cancelada", "anulada"}
        count = session.exec(
            select(func.count(PoOrder.id))
            .select_from(PoOrder)
            .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
            .where(PoOrder.deleted_at.is_(None))
            .where(PoOrder.oportunidad_id == oportunidad_id)
            .where(func.lower(PoOrderStatus.nombre).in_(REJECTED_STATUS_KEYS))
        ).one()
        return int(count or 0) > 0
    
    return False


def fetch_current_proyectos_for_dashboard(
    session: Session,
    start_date: str,
    end_date: str,
    responsable_ids: Optional[List[int]] = None,
    estado_ids: Optional[List[str]] = None,
    centro_costo_ids: Optional[List[int]] = None,
) -> List[Proyecto]:
    """Obtiene proyectos actuales para el dashboard"""
    
    stmt = select(Proyecto).options(
        selectinload(Proyecto.avances),
    )
    
    # Aplicar filtros
    if responsable_ids:
        stmt = stmt.where(Proyecto.responsable_id.in_(responsable_ids))
    
    if estado_ids:
        stmt = stmt.where(Proyecto.estado.in_(estado_ids))
        
    if centro_costo_ids:
        stmt = stmt.where(Proyecto.centro_costo.in_(centro_costo_ids))
    
    # Solo proyectos activos o recientemente actualizados
    cutoff_date = datetime.now() - timedelta(days=90)
    stmt = stmt.where(
        (Proyecto.estado.in_(ACTIVE_PROJECT_STATES)) |
        (Proyecto.updated_at >= cutoff_date)
    )
    
    return session.exec(stmt).all()


def _calculate_batch_costo_ejecutado(
    session: Session,
    oportunidad_ids: List[int]
) -> Dict[int, Decimal]:
    """Calcula costos ejecutados para múltiples oportunidades en una sola query (optimización batch)"""
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🚀 BATCH COSTO: Calculando para {len(oportunidad_ids)} oportunidades")
    
    if not oportunidad_ids:
        return {}
    
    # Estados que consideramos "ejecutados" 
    # Basado en análisis real de la BD: solicitada, aprobada, en_proceso son estados válidos
    EXECUTED_STATUS_KEYS = {"solicitada", "aprobada", "en_proceso", "emitida", "facturada", "pagada", "completada", "entregada"}
    
    # UNA SOLA query para todas las oportunidades (BATCH QUERY)
    stmt_batch = (
        select(PoOrder.oportunidad_id, func.sum(PoOrder.total))
        .select_from(PoOrder)
        .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
        .where(PoOrder.deleted_at.is_(None))
        .where(PoOrder.oportunidad_id.in_(oportunidad_ids))  # IN clause para múltiples IDs
        .where(func.lower(PoOrderStatus.nombre).in_(EXECUTED_STATUS_KEYS))
        .group_by(PoOrder.oportunidad_id)
    )
    
    # Ejecutar y convertir a diccionario {oportunidad_id: costo_total}
    results = session.exec(stmt_batch).all()
    resultado = {oportunidad_id: (costo or Decimal("0")) for oportunidad_id, costo in results}
    
    logger.info(f"🎯 BATCH RESULT: Encontrados costos para {len(resultado)} oportunidades")
    return resultado


def build_dashboard_detail_entry_from_proyecto(
    proyecto: Proyecto, 
    context_key: str = "general",
    session: Session = None,
    costo_ejecutado_precalculado: Optional[Decimal] = None
) -> Dict:
    """Construye entrada de detalle para un proyecto (optimizado con batch queries)"""
    
    # Calcular métricas de avance
    avances = proyecto.avances or []
    if avances:
        avance_total = max(a.avance for a in avances)
        ultimo_avance_fecha = max(a.fecha_registracion for a in avances)
        importe_ejecutado = sum(a.importe for a in avances)
        horas_trabajadas = sum(a.horas for a in avances)
    else:
        avance_total = Decimal("0")
        ultimo_avance_fecha = None
        importe_ejecutado = Decimal("0")
        horas_trabajadas = 0
    
    # Usar costo precalculado si está disponible (OPTIMIZACIÓN BATCH)
    if costo_ejecutado_precalculado is not None:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"✅ BATCH: Usando costo precalculado {costo_ejecutado_precalculado} para proyecto {proyecto.id}")
        costo_ejecutado = costo_ejecutado_precalculado
    else:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"❌ FALLBACK: Calculando costo individual para proyecto {proyecto.id}")
        # Fallback: cálculo individual (solo si no hay batch)
        costo_ejecutado = Decimal("0")
        if proyecto.oportunidad_id and session:
            # Estados que consideramos "ejecutados" 
            # Basado en análisis real de la BD: solicitada, aprobada, en_proceso son estados válidos
            EXECUTED_STATUS_KEYS = {"solicitada", "aprobada", "en_proceso", "emitida", "facturada", "pagada", "completada", "entregada"}
            
            stmt_ordenes = (
                select(func.sum(PoOrder.total))
                .select_from(PoOrder)
                .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
                .where(PoOrder.deleted_at.is_(None))
                .where(PoOrder.oportunidad_id == proyecto.oportunidad_id)
                .where(func.lower(PoOrderStatus.nombre).in_(EXECUTED_STATUS_KEYS))
            )
            
            result = session.exec(stmt_ordenes).one()
            costo_ejecutado = result or Decimal("0")
    
    return {
        "proyecto": proyecto,
        "estado_al_corte": proyecto.estado or "SIN_ESTADO",
        "avance": float(avance_total),
        "importe_ejecutado": float(importe_ejecutado),  # Desde avances manuales
        "costo_ejecutado": float(costo_ejecutado),      # Desde órdenes de compra (OPTIMIZADO)
        "horas_trabajadas": horas_trabajadas,
        "fecha_creacion": _parse_date(proyecto.created_at),
        "fecha_ultimo_avance": ultimo_avance_fecha,
        "bucket": _month_bucket(ultimo_avance_fecha),
        "context": context_key,
    }


def build_dashboard_detail_entry_from_calculated_proyecto(
    calculated_proyecto: CalculatedProyecto, 
    context_key: str = "general"
) -> Dict:
    """
    🚀 NUEVA FUNCIÓN: Construye entrada de detalle usando CalculatedProyecto (sin queries adicionales)
    """
    
    proyecto = calculated_proyecto.proyecto
    
    return {
        "proyecto": proyecto,
        "estado_al_corte": calculated_proyecto.estado_al_corte,
        "avance": float(calculated_proyecto.avance_total),
        "importe_ejecutado": float(calculated_proyecto.importe_ejecutado or 0),
        "costo_ejecutado": float(calculated_proyecto.costo_ejecutado or 0),  # 🚀 Pre-calculado!
        "horas_trabajadas": calculated_proyecto.horas_trabajadas,
        "fecha_creacion": calculated_proyecto.fecha_creacion.isoformat(),
        "fecha_ultimo_avance": (
            calculated_proyecto.fecha_ultimo_avance.isoformat() 
            if calculated_proyecto.fecha_ultimo_avance else None
        ),
        "bucket": calculated_proyecto.bucket_ultimo_avance or calculated_proyecto.bucket_creacion,
        "context": context_key,
    }


def fetch_selector_summary_fast(
    session: Session,
    start_date: str,
    end_date: str,
    proyecto_ids: Optional[List[int]] = None,
    responsable_ids: Optional[List[int]] = None,
    estado_ids: Optional[List[str]] = None,
    centro_costo_ids: Optional[List[int]] = None,
) -> Dict:
    """Resumen rápido para selectores"""
    
    stmt = select(Proyecto)
    
    # Aplicar filtros
    if proyecto_ids:
        stmt = stmt.where(Proyecto.id.in_(proyecto_ids))

    if responsable_ids:
        stmt = stmt.where(Proyecto.responsable_id.in_(responsable_ids))
    
    if estado_ids:
        stmt = stmt.where(Proyecto.estado.in_(estado_ids))
        
    if centro_costo_ids:
        stmt = stmt.where(Proyecto.centro_costo.in_(centro_costo_ids))
    
    proyectos = session.exec(stmt).all()
    
    # Conteos por estado
    count_by_estado = {}
    for proyecto in proyectos:
        estado = proyecto.estado or "SIN_ESTADO"
        count_by_estado[estado] = count_by_estado.get(estado, 0) + 1
    
    return {
        "total": len(proyectos),
        "por_estado": count_by_estado,
    }
