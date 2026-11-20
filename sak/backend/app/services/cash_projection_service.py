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
    MetodoProyeccionDetalle,
)
from app.services.cash_projection_horizon import HISTORY_START


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
    projection_detail_id: int | None
    target_month: date
    base_month_from: int
    base_month_to: int
    function: FuncionProyeccion | None
    factor: Decimal
    base_value: Decimal
    projected_value: Decimal
    base_values: tuple[ProjectionBaseValue, ...]
    tipo_calculo: str = "HISTORICO"
    cuenta_cash_referencia_id: int | None = None
    origen_proyectado: str = "CALCULADO"


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
        return next((value for value in reversed(values) if value != 0), Decimal("0"))
    if function == FuncionProyeccion.PROMEDIO:
        return sum(values, Decimal("0")) / Decimal(len(values))
    if function == FuncionProyeccion.SUMA:
        return sum(values, Decimal("0"))
    if function == FuncionProyeccion.MAX:
        return max(values)
    if function == FuncionProyeccion.MIN:
        return min(values)
    raise ProjectionConfigurationError(f"La funcion de proyeccion '{function}' no es valida")


def _calculate_historical(
    data: "CashProjectionEngine",
    *,
    cash_account_id: int,
    target_month: date,
    projection_method_id: int | None = None,
    projected_overrides: Mapping[date, Decimal] | None = None,
) -> CashProjectionCalculation:
    """Calcula, sin persistir, un mes proyectado para una cuenta Cash.

    Los meses base cerrados toman valores reales. Los no cerrados toman la
    proyeccion existente de la misma cuenta Cash.
    Los reales se calculan con la propia cuenta Cash.
    """

    target_month = _month_start(target_month)
    normalized_overrides = {
        _month_start(month): Decimal(str(value))
        for month, value in (projected_overrides or {}).items()
    }
    cash_account = data.accounts.get(cash_account_id)
    if cash_account is None:
        raise ProjectionConfigurationError(
            f"La cuenta Cash {cash_account_id} no existe o esta eliminada"
        )
    selected_method_id = projection_method_id or cash_account.id_metodo_proyeccion
    if selected_method_id is None:
        raise ProjectionConfigurationError(
            f"La cuenta Cash {cash_account_id} no tiene metodo de proyeccion"
        )

    method = data.methods.get(selected_method_id)
    if method is not None and not method.activo:
        method = None
    if method is None:
        raise ProjectionConfigurationError(
            "El metodo de proyeccion "
            f"{selected_method_id} no existe o no esta activo"
        )

    data.load_historical_sources()
    rules = data.rules.get((method.id, target_month.month), [])
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
    if function == FuncionProyeccion.AJUSTE_PONDERADO and not Decimal("0") <= factor <= Decimal("1"):
        raise ProjectionConfigurationError("El factor de Ajuste ponderado debe estar entre 0 y 1")

    base_start = _shift_month(target_month, rule.mes_base_desde)
    base_end = _shift_month(target_month, rule.mes_base_hasta)
    if function == FuncionProyeccion.PROMEDIO:
        base_start = max(base_start, HISTORY_START)
    base_months = _iter_months(base_start, base_end) if base_start <= base_end else ()

    period_statuses = data.period_statuses
    real_source = "REAL_CUENTA_CASH"
    real_values: dict[date, Decimal] = {}
    for month, transaction_date, value in data.real_values.get(cash_account_id, []):
        if base_start <= transaction_date < _shift_month(base_end, 1):
            real_values[month] = real_values.get(month, Decimal("0")) + value
    projected_values = {
        month: Decimal(row.importe_proyectado or 0)
        if function == FuncionProyeccion.PROMEDIO else Decimal(row.importe_proyectado)
        for (account_id, month), row in data.stored.items()
        if account_id == cash_account_id and base_start <= month <= base_end
    }

    base_values: list[ProjectionBaseValue] = []
    weighted = function == FuncionProyeccion.AJUSTE_PONDERADO
    for month in ((base_end,) if weighted else base_months):
        status = period_statuses.get(month, "ABIERTO")
        if not weighted and status == "CERRADO" and (data.reference_from is None or month < data.reference_from):
            value = real_values.get(month, Decimal("0"))
            source = real_source
        else:
            if month in normalized_overrides:
                value = normalized_overrides[month]
                source = "PROYECTADO_CALCULADO"
            elif month in projected_values:
                value = projected_values[month]
                source = "PROYECTADO_EXISTENTE"
            elif function == FuncionProyeccion.PROMEDIO:
                value = Decimal("0")
                source = "PROYECTADO_FALTANTE_CERO"
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

    if weighted:
        base_value = base_values[0].value
        amount = base_value
        if period_statuses.get(base_end) == "CERRADO" and base_end in real_values:
            real = real_values[base_end]
            amount += (real - base_value) * factor
            base_values.append(ProjectionBaseValue(base_end, "CERRADO", real_source, real))
        projected_value = amount.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    else:
        base_value = (
            Decimal("0") if function == FuncionProyeccion.PROMEDIO and not base_values
            else _aggregate(function, tuple(item.value for item in base_values))
        )
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
        base_value=base_value,
        projected_value=projected_value,
        base_values=tuple(base_values),
    )


class CashProjectionEngine:
    """Resuelve dependencias del mismo mes una sola vez; no persiste resultados."""

    def __init__(self, session: Session, *, method_overrides=None, projected_overrides=None, relational_overrides=None,
        projection_origins=None, reference_from: date | None = None):
        from app.services.cash_projection_configuration import validate_cash_dependencies
        self.session = session
        self.reference_from = reference_from
        self.method_overrides = method_overrides or {}
        self.relational_overrides = relational_overrides or {}
        validate_cash_dependencies(session, method_overrides=self.method_overrides, relational_overrides=self.relational_overrides)
        # Keep one snapshot per calculation, avoiding database trips per account/month.
        self.accounts = {row.id: row for row in session.exec(select(ErpCashCuenta).where(
            ErpCashCuenta.deleted_at.is_(None))).all()}
        self.methods = {row.id: row for row in session.exec(select(MetodoProyeccion).where(
            MetodoProyeccion.deleted_at.is_(None))).all()}
        self.stored = {(row.cuenta_cash_id, row.fecha_periodo): row for row in session.exec(
            select(ErpCashProyectado).where(ErpCashProyectado.deleted_at.is_(None))).all()}
        self.period_statuses = {row.fecha_periodo: row.estado for row in session.exec(
            select(ErpCashPeriodo).where(ErpCashPeriodo.deleted_at.is_(None))).all()}
        self.rules = None
        self.real_values = {}
        self.values = dict(projected_overrides or {})
        self.projection_origins = projection_origins or {}
        self.manual_overrides = set(self.values)
        self.cache = {}
        self.visiting = []

    def load_historical_sources(self):
        if self.rules is not None:
            return
        self.rules = {}
        for rule in self.session.exec(select(MetodoProyeccionDetalle).where(
            MetodoProyeccionDetalle.deleted_at.is_(None))).all():
            self.rules.setdefault((rule.id_metodo_proyeccion, rule.mes_destino), []).append(rule)
        # Preserve the date filter and accounting-period grouping used by historical rules.
        rows = self.session.exec(select(
            ErpCashDiario.cuenta_cash_id, ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes, ErpCashDiario.fecha,
            func.sum(-(ErpCashDiario.debe + ErpCashDiario.haber)),
        ).where(ErpCashDiario.deleted_at.is_(None)).group_by(
            ErpCashDiario.cuenta_cash_id, ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes, ErpCashDiario.fecha,
        )).all()
        for account_id, year, month, transaction_date, value in rows:
            self.real_values.setdefault(account_id, []).append(
                (date(year, month, 1), transaction_date, Decimal(value or 0)))

    def calculate(self, account_id: int, month: date, *, force: bool = False) -> CashProjectionCalculation:
        month = _month_start(month)
        key = (account_id, month)
        if key in self.visiting:
            chain = self.visiting[self.visiting.index(key):] + [key]
            raise ProjectionConfigurationError("Dependencia circular: " + " → ".join(
                f"{self.accounts[item[0]].descripcion} ({item[1]:%Y-%m})" for item in chain))
        if key in self.cache:
            return self.cache[key]
        account = self.accounts.get(account_id)
        if account is None or account.deleted_at is not None:
            raise ProjectionConfigurationError(f"La cuenta Cash {account_id} no existe")
        method_id = self.method_overrides.get(account_id, account.id_metodo_proyeccion)
        method = self.methods.get(method_id) if method_id else None
        if method_id and (method is None or method.deleted_at is not None or not method.activo):
            raise ProjectionConfigurationError(f"El método de {account.descripcion} no existe o está inactivo")
        stored = self.stored.get(key)
        kind = method.tipo_calculo if method else "HISTORICO"
        self.visiting.append(key)
        try:
            base_values = ()
            factor = Decimal("1")
            reference = None
            if kind == "PENDIENTE":
                value = Decimal(stored.importe_pendiente if stored else 0)
                base_values = (ProjectionBaseValue(month, "ACTUAL", "PENDIENTE", value),)
            elif not force and key in self.values:
                value = self.values[key]
            elif not force and stored is not None and (self.projection_origins.get(key, stored.origen_proyectado) == "MANUAL" or method is None):
                value = Decimal(stored.importe_proyectado)
                base_values = (ProjectionBaseValue(month, "ACTUAL", "MANUAL", value),)
            elif method is None:
                raise ProjectionConfigurationError(f"La cuenta {account.descripcion} no tiene método ni un proyectado disponible para {month:%Y-%m}")
            elif kind == "RELACIONAL":
                relational = self.relational_overrides.get(account_id, {})
                reference = relational.get("cuenta_cash_referencia_id", account.cuenta_cash_referencia_id)
                percentage = relational.get("porcentaje", account.porcentaje)
                if reference is None or percentage is None:
                    raise ProjectionConfigurationError(f"{account.descripcion}: referencia y porcentaje obligatorios")
                base = self.calculate(reference, month).projected_value
                factor = Decimal(str(percentage)) / Decimal("100")
                value = (base * factor).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
                base_values = (ProjectionBaseValue(month, "ACTUAL", "RELACIONAL", base),)
            else:
                result = _calculate_historical(self, cash_account_id=account_id, target_month=month,
                    projection_method_id=method_id,
                    projected_overrides={m: v for (a, m), v in self.values.items() if a == account_id})
                self.cache[key] = result
                self.values[key] = result.projected_value
                return result
            result = CashProjectionCalculation(
                cash_account_id=account_id, cash_account_description=account.descripcion,
                projection_method_id=method_id, projection_method_name=method.nombre if method else "Manual",
                projection_detail_id=None, target_month=month, base_month_from=0, base_month_to=0,
                function=None, factor=factor, base_value=base_values[0].value if base_values else value,
                projected_value=value, base_values=base_values, tipo_calculo=kind,
                cuenta_cash_referencia_id=reference,
                origen_proyectado="MANUAL" if not force and (key in self.manual_overrides
                    or (stored is not None and self.projection_origins.get(key, stored.origen_proyectado) == "MANUAL")) else "CALCULADO")
            self.cache[key] = result
            self.values[key] = result.projected_value
            return result
        finally:
            self.visiting.pop()


def calculate_cash_projection(session: Session, *, cash_account_id: int, target_month: date,
    projection_method_id: int | None = None, projected_overrides: Mapping[date, Decimal] | None = None):
    engine = CashProjectionEngine(session,
        method_overrides={cash_account_id: projection_method_id} if projection_method_id else None,
        projected_overrides={(cash_account_id, _month_start(m)): v for m, v in (projected_overrides or {}).items()})
    return engine.calculate(cash_account_id, target_month, force=True)


def project_cash_account_range(session: Session, *, cash_account_id: int, period_from: date,
    period_to: date, projection_method_id: int | None = None,
    relational_values: dict | None = None,
    preview_values: Mapping[date, tuple[Decimal, str]] | None = None,
    reference_from: date | None = None) -> list[CashProjectionCalculation]:
    period_from, period_to = _month_start(period_from), _month_start(period_to)
    if period_from > period_to:
        raise ProjectionConfigurationError("El periodo desde no puede ser posterior al periodo hasta")
    engine = CashProjectionEngine(session,
        method_overrides={cash_account_id: projection_method_id} if projection_method_id else None,
        relational_overrides={cash_account_id: relational_values} if relational_values is not None else None,
        projected_overrides={(cash_account_id, month): amount for month, (amount, origin) in (preview_values or {}).items()
            if origin == "MANUAL"},
        projection_origins={(cash_account_id, month): origin for month, (_, origin) in (preview_values or {}).items()},
        reference_from=reference_from)
    return [engine.calculate(cash_account_id, month) for month in _iter_months(period_from, period_to)]
