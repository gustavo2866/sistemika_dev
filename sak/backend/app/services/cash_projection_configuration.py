"""Validación y bloqueo de la configuración compartida de proyecciones."""
from decimal import Decimal, InvalidOperation

from sqlalchemy import text
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.metodo_proyeccion import FuncionProyeccion, MetodoProyeccion

CALCULATION_TYPES = {"HISTORICO", "RELACIONAL", "PENDIENTE"}


def lock_projection_configuration(session: Session) -> None:
    if session.get_bind().dialect.name == "postgresql":
        session.execute(text("SELECT pg_advisory_xact_lock(673482901)"))


def validate_method_rules(kind: str, rules: list) -> None:
    if kind not in CALCULATION_TYPES:
        raise ValueError("Tipo de cálculo inválido")
    if kind != "HISTORICO":
        if rules:
            raise ValueError("Solo los métodos históricos admiten reglas de cálculo")
        return
    if not rules:
        raise ValueError("Un método histórico requiere al menos una regla de cálculo")
    seen = set()
    for rule in rules:
        values = rule if isinstance(rule, dict) else rule.model_dump()
        month = int(values["mes_destino"])
        if month not in range(1, 13) or month in seen:
            raise ValueError("Los meses destino deben estar entre 1 y 12 y no repetirse")
        seen.add(month)
        if not int(values["mes_base_desde"]) <= int(values["mes_base_hasta"]) < 0:
            raise ValueError("Las bases deben ser meses anteriores y formar un rango ordenado")
        try:
            FuncionProyeccion(values.get("funcion"))
            if not Decimal(str(values.get("factor"))).is_finite():
                raise ValueError()
        except (ValueError, InvalidOperation):
            raise ValueError("La regla requiere una función válida y un factor finito") from None
        if values.get("funcion") == FuncionProyeccion.AJUSTE_PONDERADO and not Decimal("0") <= Decimal(str(values["factor"])) <= Decimal("1"):
            raise ValueError("El factor de Ajuste ponderado debe estar entre 0 y 1")


def validate_cash_dependencies(session: Session, *, method_overrides: dict[int, int] | None = None,
    relational_overrides: dict[int, dict] | None = None) -> None:
    accounts = {a.id: a for a in session.exec(select(ErpCashCuenta).where(ErpCashCuenta.deleted_at.is_(None))).all()}
    methods = {m.id: m for m in session.exec(select(MetodoProyeccion).where(MetodoProyeccion.deleted_at.is_(None))).all()}
    edges = {}
    for account_id, account in accounts.items():
        method_id = (method_overrides or {}).get(account_id, account.id_metodo_proyeccion)
        method = methods.get(method_id)
        if method_id and method is None:
            raise ValueError(f"El método de {account.descripcion} no existe")
        if method and method.tipo_calculo == "RELACIONAL":
            relational = (relational_overrides or {}).get(account_id, {})
            reference = relational.get("cuenta_cash_referencia_id", account.cuenta_cash_referencia_id)
            percentage = relational.get("porcentaje", account.porcentaje)
            if reference not in accounts:
                raise ValueError(f"{account.descripcion}: la cuenta Cash de referencia es obligatoria y debe existir")
            if percentage is None or not Decimal(str(percentage)).is_finite():
                raise ValueError(f"{account.descripcion}: el porcentaje es obligatorio y debe ser finito")
            edges[account_id] = reference

    done, path = set(), []

    def visit(account_id):
        if account_id in path:
            cycle = path[path.index(account_id):] + [account_id]
            names = " → ".join(accounts[key].descripcion for key in cycle)
            raise ValueError(f"Dependencia circular: {names}")
        if account_id in done:
            return
        path.append(account_id)
        if account_id in edges:
            visit(edges[account_id])
        path.pop()
        done.add(account_id)

    for account_id in accounts:
        visit(account_id)
