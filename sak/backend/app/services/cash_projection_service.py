from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Mapping

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import (
    FuncionProyeccion,
    MetodoProyeccion,
    MetodoProyeccionCuenta,
    MetodoProyeccionDetalle,
)


MONEY_QUANTUM = Decimal("0.01")


class CashProjectionError(ValueError):
    """Error base del calculo de una proyeccion Cash."""


class ProjectionConfigurationError(CashProjectionError):
    """La cuenta o el metodo no tienen una configuracion valida."""


class ProjectionDataError(CashProjectionError):
    """Falta un valor necesario para completar el calculo."""

    def __init__(
        self,
        message: str,
        *,
        cash_account_id: int,
        missing_month: date,
        reason: str = "MISSING_PROJECTION",
    ) -> None:
        super().__init__(message)
        self.cash_account_id = cash_account_id
        self.missing_month = missing_month
        self.reason = reason


@dataclass(frozen=True)
class ProjectionBaseValue:
    month: date
    period_status: str
    source: str
    value: Decimal


@dataclass(frozen=True)
class CashProjectionCalculation:
    cash_account_id: int
    cash_account_description: str
    projection_method_id: int
    projection_method_name: str
    projection_detail_id: int
    target_month: date
    base_month_from: int
    base_month_to: int
    function: FuncionProyeccion
    factor: Decimal
    erp_account_numbers: tuple[int, ...]
    base_value: Decimal
    projected_value: Decimal
    base_values: tuple[ProjectionBaseValue, ...]


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _shift_month(value: date, offset: int) -> date:
    absolute_month = value.year * 12 + value.month - 1 + offset
    year, zero_based_month = divmod(absolute_month, 12)
    return date(year, zero_based_month + 1, 1)


def _iter_months(start: date, end: date) -> tuple[date, ...]:
    months: list[date] = []
    current = start
    while current <= end:
        months.append(current)
        current = _shift_month(current, 1)
    return tuple(months)


def _normalize_function(value: FuncionProyeccion | str | None) -> FuncionProyeccion:
    if value is None:
        raise ProjectionConfigurationError("La regla no tiene una funcion configurada")
    if isinstance(value, FuncionProyeccion):
        return value
    try:
        return FuncionProyeccion(str(value).strip().upper())
    except ValueError as exc:
        raise ProjectionConfigurationError(
            f"La funcion de proyeccion '{value}' no es valida"
        ) from exc


def _aggregate(function: FuncionProyeccion, values: tuple[Decimal, ...]) -> Decimal:
    if not values:
        raise ProjectionConfigurationError("La regla no contiene meses base")
    if function == FuncionProyeccion.ULTIMO:
        return values[-1]
    if function == FuncionProyeccion.PROMEDIO:
        return sum(values, Decimal("0")) / Decimal(len(values))
    if function == FuncionProyeccion.SUMA:
        return sum(values, Decimal("0"))
    if function == FuncionProyeccion.MAX:
        return max(values)
    if function == FuncionProyeccion.MIN:
        return min(values)
    raise ProjectionConfigurationError(f"La funcion de proyeccion '{function}' no es valida")


def calculate_cash_projection(
    session: Session,
    *,
    cash_account_id: int,
    target_month: date,
    projection_method_id: int | None = None,
    projected_overrides: Mapping[date, Decimal] | None = None,
) -> CashProjectionCalculation:
    """Calcula, sin persistir, un mes proyectado para una cuenta Cash.

    Los meses base cerrados toman valores reales. Los no cerrados toman la
    proyeccion existente de la misma cuenta Cash. Si el metodo posee cuentas
    ERP activas, los valores reales se calculan con esas cuentas; en caso
    contrario se calculan con la propia cuenta Cash.
    """

    target_month = _month_start(target_month)
    normalized_overrides = {
        _month_start(month): Decimal(str(value))
        for month, value in (projected_overrides or {}).items()
    }
    cash_account = session.exec(
        select(ErpCashCuenta).where(
            ErpCashCuenta.id == cash_account_id,
            ErpCashCuenta.deleted_at.is_(None),
        )
    ).one_or_none()
    if cash_account is None:
        raise ProjectionConfigurationError(
            f"La cuenta Cash {cash_account_id} no existe o esta eliminada"
        )
    selected_method_id = projection_method_id or cash_account.id_metodo_proyeccion
    if selected_method_id is None:
        raise ProjectionConfigurationError(
            f"La cuenta Cash {cash_account_id} no tiene metodo de proyeccion"
        )

    method = session.exec(
        select(MetodoProyeccion).where(
            MetodoProyeccion.id == selected_method_id,
            MetodoProyeccion.activo.is_(True),
            MetodoProyeccion.deleted_at.is_(None),
        )
    ).one_or_none()
    if method is None:
        raise ProjectionConfigurationError(
            "El metodo de proyeccion "
            f"{selected_method_id} no existe o no esta activo"
        )

    rules = session.exec(
        select(MetodoProyeccionDetalle).where(
            MetodoProyeccionDetalle.id_metodo_proyeccion == method.id,
            MetodoProyeccionDetalle.mes_destino == target_month.month,
            MetodoProyeccionDetalle.deleted_at.is_(None),
        )
    ).all()
    if not rules:
        raise ProjectionConfigurationError(
            f"El metodo {method.id} no tiene una regla para el mes {target_month.month}"
        )
    if len(rules) > 1:
        raise ProjectionConfigurationError(
            f"El metodo {method.id} tiene mas de una regla para el mes {target_month.month}"
        )

    rule = rules[0]
    if rule.mes_base_desde > rule.mes_base_hasta:
        raise ProjectionConfigurationError("El rango de meses base es invalido")
    if rule.mes_base_hasta >= 0:
        raise ProjectionConfigurationError(
            "Los meses base deben ser anteriores al mes objetivo "
            "para evitar dependencias circulares"
        )

    function = _normalize_function(rule.funcion)
    factor = Decimal(str(rule.factor))
    if not factor.is_finite():
        raise ProjectionConfigurationError("El factor de la regla no es valido")

    base_start = _shift_month(target_month, rule.mes_base_desde)
    base_end = _shift_month(target_month, rule.mes_base_hasta)
    base_months = _iter_months(base_start, base_end)

    period_rows = session.exec(
        select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado).where(
            ErpCashPeriodo.fecha_periodo >= base_start,
            ErpCashPeriodo.fecha_periodo <= base_end,
            ErpCashPeriodo.deleted_at.is_(None),
        )
    ).all()
    period_statuses = {
        _month_start(period_month): str(status).strip().upper()
        for period_month, status in period_rows
    }

    method_account_rows = session.exec(
        select(MetodoProyeccionCuenta.nro_cuenta).where(
            MetodoProyeccionCuenta.id_metodo_proyeccion == method.id,
            MetodoProyeccionCuenta.activo.is_(True),
            MetodoProyeccionCuenta.deleted_at.is_(None),
        )
    ).all()
    erp_account_numbers = tuple(int(value) for value in method_account_rows)

    real_statement = (
        select(
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
            func.sum(-(ErpCashDiario.debe + ErpCashDiario.haber)).label("value"),
        )
        .where(
            ErpCashDiario.fecha >= base_start,
            ErpCashDiario.fecha < _shift_month(base_end, 1),
            ErpCashDiario.deleted_at.is_(None),
        )
        .group_by(ErpCashDiario.periodo_anio, ErpCashDiario.periodo_mes)
    )
    if erp_account_numbers:
        real_statement = real_statement.where(
            ErpCashDiario.cuenta_codigo.in_(erp_account_numbers)
        )
        real_source = "REAL_CUENTAS_ERP"
    else:
        real_statement = real_statement.where(
            ErpCashDiario.cuenta_cash_id == cash_account_id
        )
        real_source = "REAL_CUENTA_CASH"

    real_values = {
        date(int(year), int(month), 1): Decimal(str(value or 0))
        for year, month, value in session.exec(real_statement).all()
    }
    projected_values = {
        _month_start(month): Decimal(str(value or 0))
        for month, value in session.exec(
            select(
                ErpCashProyectado.fecha_periodo,
                func.sum(ErpCashProyectado.importe),
            )
            .where(
                ErpCashProyectado.cuenta_cash_id == cash_account_id,
                ErpCashProyectado.fecha_periodo >= base_start,
                ErpCashProyectado.fecha_periodo <= base_end,
                ErpCashProyectado.tipo == "PROYECCION",
                ErpCashProyectado.deleted_at.is_(None),
            )
            .group_by(ErpCashProyectado.fecha_periodo)
        ).all()
    }

    base_values: list[ProjectionBaseValue] = []
    for month in base_months:
        status = period_statuses.get(month, "ABIERTO")
        if status == "CERRADO":
            value = real_values.get(month, Decimal("0"))
            source = real_source
        else:
            if month in normalized_overrides:
                value = normalized_overrides[month]
                source = "PROYECTADO_CALCULADO"
            elif month in projected_values:
                value = projected_values[month]
                source = "PROYECTADO_EXISTENTE"
            else:
                raise ProjectionDataError(
                    f"No existe una proyeccion para la cuenta Cash {cash_account_id} "
                    f"en el periodo {month:%Y-%m}",
                    cash_account_id=cash_account_id,
                    missing_month=month,
                )
        base_values.append(
            ProjectionBaseValue(
                month=month,
                period_status=status,
                source=source,
                value=value,
            )
        )

    base_value = _aggregate(function, tuple(item.value for item in base_values))
    projected_value = (base_value * factor).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    return CashProjectionCalculation(
        cash_account_id=cash_account_id,
        cash_account_description=cash_account.descripcion,
        projection_method_id=method.id,
        projection_method_name=method.nombre,
        projection_detail_id=rule.id,
        target_month=target_month,
        base_month_from=rule.mes_base_desde,
        base_month_to=rule.mes_base_hasta,
        function=function,
        factor=factor,
        erp_account_numbers=erp_account_numbers,
        base_value=base_value,
        projected_value=projected_value,
        base_values=tuple(base_values),
    )


def project_cash_account_range(
    session: Session,
    *,
    cash_account_id: int,
    period_from: date,
    period_to: date,
    projection_method_id: int | None = None,
) -> list[CashProjectionCalculation]:
    """Calcula cronologicamente una cuenta Cash para un rango, sin persistir.

    Cada resultado se incorpora a un contexto en memoria y puede ser utilizado
    como valor base por los periodos siguientes de la misma ejecucion.
    """

    period_from = _month_start(period_from)
    period_to = _month_start(period_to)
    if period_from > period_to:
        raise ProjectionConfigurationError(
            "El periodo desde no puede ser posterior al periodo hasta"
        )

    calculated_values: dict[date, Decimal] = {}
    results: list[CashProjectionCalculation] = []
    for target_month in _iter_months(period_from, period_to):
        calculation = calculate_cash_projection(
            session,
            cash_account_id=cash_account_id,
            target_month=target_month,
            projection_method_id=projection_method_id,
            projected_overrides=calculated_values,
        )
        results.append(calculation)
        calculated_values[target_month] = calculation.projected_value

    return results
