from datetime import date
from decimal import Decimal

from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import (
    QUICK_EDIT_COMMITTED_TYPE,
    QUICK_EDIT_PENDING_TYPE,
    calculate_projection_quick_edit,
    get_projection_quick_edit,
    projection_months,
    save_projection_quick_edit,
)
from app.models.metodo_proyeccion import (
    FuncionProyeccion,
    MetodoProyeccion,
    MetodoProyeccionDetalle,
)


def _create_projection_account(session: Session) -> ErpCashCuenta:
    method = MetodoProyeccion(nombre="Mes anterior quick edit", activo=True)
    session.add(method)
    session.flush()
    session.add_all(
        [
            MetodoProyeccionDetalle(
                id_metodo_proyeccion=method.id,
                mes_destino=month,
                mes_base_desde=-1,
                mes_base_hasta=-1,
                funcion=FuncionProyeccion.ULTIMO,
                factor=Decimal("1"),
            )
            for month in range(1, 13)
        ]
    )
    account = ErpCashCuenta(
        descripcion="Cuenta quick edit",
        tipo="Ingreso",
        id_metodo_proyeccion=method.id,
    )
    session.add(account)
    session.flush()
    return account


def _add_real(
    session: Session,
    *,
    account_id: int,
    source_id: int,
    month: date,
    value: Decimal,
) -> None:
    session.add(
        ErpCashDiario(
            source_id=source_id,
            empresa_id=1,
            fecha=month,
            periodo_anio=month.year,
            periodo_mes=month.month,
            cuenta_codigo=100,
            cuenta_cash_id=account_id,
            debe=-value,
            haber=Decimal("0"),
        )
    )


def test_quick_edit_incluye_importe_real_solo_cuando_hay_movimientos(
    db_session: Session,
):
    account = _create_projection_account(db_session)
    _add_real(
        db_session,
        account_id=account.id,
        source_id=100,
        month=date(2026, 1, 15),
        value=Decimal("2500000"),
    )
    db_session.add(
        ErpCashPeriodo(fecha_periodo=date(2026, 1, 1), estado="CERRADO")
    )
    db_session.add(
        ErpCashProyectado(
            cuenta_cash_id=account.id,
            fecha_periodo=date(2026, 1, 1),
            tipo=QUICK_EDIT_COMMITTED_TYPE,
            importe=Decimal("750000"),
            observacion="Orden confirmada",
        )
    )
    db_session.add(
        ErpCashProyectado(
            cuenta_cash_id=account.id,
            fecha_periodo=date(2026, 1, 1),
            tipo=QUICK_EDIT_PENDING_TYPE,
            importe=Decimal("250000"),
        )
    )
    db_session.commit()

    result = get_projection_quick_edit(db_session, account.id, 2026)

    assert result["metodo_proyeccion_id"] == account.id_metodo_proyeccion
    assert result["values"][0]["importe_real"] == 2500000.0
    assert result["values"][0]["estado_periodo"] == "CERRADO"
    assert result["values"][0]["importe_pendiente"] == 250000.0
    assert result["values"][0]["importe_comprometido"] == 750000.0
    assert result["values"][0]["descripcion"] == "Orden confirmada"
    assert result["values"][1]["importe_real"] is None
    assert result["values"][1]["estado_periodo"] == "ABIERTO"


def test_calcular_quick_edit_devuelve_24_meses_trazables_sin_persistir(
    db_session: Session,
):
    account = _create_projection_account(db_session)
    db_session.add(
        ErpCashPeriodo(fecha_periodo=date(2025, 12, 1), estado="CERRADO")
    )
    _add_real(
        db_session,
        account_id=account.id,
        source_id=200,
        month=date(2025, 12, 15),
        value=Decimal("1750000"),
    )
    db_session.commit()

    result = calculate_projection_quick_edit(db_session, account.id, 2026)

    assert len(result["values"]) == 24
    assert result["values"][0]["periodo"] == "2026-01-01"
    assert result["values"][-1]["periodo"] == "2027-12-01"
    assert {item["importe"] for item in result["values"]} == {1750000.0}
    assert result["values"][1]["parametros"]["valores_base"][0]["origen"] == (
        "PROYECTADO_CALCULADO"
    )

    stored = db_session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.cuenta_cash_id == account.id,
            ErpCashProyectado.deleted_at.is_(None),
        )
    ).all()
    assert stored == []

    range_result = calculate_projection_quick_edit(
        db_session,
        account.id,
        2026,
        period_from=date(2026, 1, 1),
        period_to=date(2026, 3, 1),
    )
    assert range_result["periodo_desde"] == "2026-01-01"
    assert range_result["periodo_hasta"] == "2026-03-01"
    assert len(range_result["values"]) == 3


def test_calcular_puede_usar_otro_metodo_sin_cambiar_la_cuenta(
    db_session: Session,
):
    account = _create_projection_account(db_session)
    original_method_id = account.id_metodo_proyeccion
    selected_method = MetodoProyeccion(nombre="Metodo temporal", activo=True)
    db_session.add(selected_method)
    db_session.flush()
    db_session.add_all(
        [
            MetodoProyeccionDetalle(
                id_metodo_proyeccion=selected_method.id,
                mes_destino=month,
                mes_base_desde=-1,
                mes_base_hasta=-1,
                funcion=FuncionProyeccion.ULTIMO,
                factor=Decimal("1"),
            )
            for month in range(1, 13)
        ]
    )
    db_session.add(
        ErpCashPeriodo(fecha_periodo=date(2025, 12, 1), estado="CERRADO")
    )
    _add_real(
        db_session,
        account_id=account.id,
        source_id=300,
        month=date(2025, 12, 15),
        value=Decimal("100"),
    )
    db_session.commit()

    result = calculate_projection_quick_edit(
        db_session,
        account.id,
        2026,
        selected_method.id,
    )

    assert result["metodo_proyeccion_id"] == selected_method.id
    assert result["values"][0]["parametros"]["metodo_proyeccion_id"] == (
        selected_method.id
    )
    db_session.refresh(account)
    assert account.id_metodo_proyeccion == original_method_id


def test_guardar_actualiza_el_metodo_asociado_a_la_cuenta(db_session: Session):
    account = _create_projection_account(db_session)
    selected_method = MetodoProyeccion(nombre="Metodo persistido", activo=True)
    db_session.add(selected_method)
    db_session.commit()

    committed_values = {
        month: (Decimal("0"), None) for month in projection_months(2026)
    }
    committed_values[date(2026, 1, 1)] = (
        Decimal("500000"),
        "Compra comprometida",
    )
    pending_values = {
        month: Decimal("0") for month in projection_months(2026)
    }
    pending_values[date(2026, 1, 1)] = Decimal("250000")
    result = save_projection_quick_edit(
        db_session,
        account.id,
        2026,
        {month: Decimal("0") for month in projection_months(2026)},
        selected_method.id,
        committed_values,
        pending_values,
    )

    db_session.refresh(account)
    assert account.id_metodo_proyeccion == selected_method.id
    assert result["metodo_proyeccion_id"] == selected_method.id
    committed = db_session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.cuenta_cash_id == account.id,
            ErpCashProyectado.fecha_periodo == date(2026, 1, 1),
            ErpCashProyectado.tipo == QUICK_EDIT_COMMITTED_TYPE,
        )
    ).one()
    assert committed.importe == Decimal("500000")
    assert committed.observacion == "Compra comprometida"
    pending = db_session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.cuenta_cash_id == account.id,
            ErpCashProyectado.fecha_periodo == date(2026, 1, 1),
            ErpCashProyectado.tipo == QUICK_EDIT_PENDING_TYPE,
        )
    ).one()
    assert pending.importe == Decimal("250000")
    assert result["pending_created"] == 1


def test_guardar_no_modifica_comprometido_de_un_periodo_cerrado(
    db_session: Session,
):
    account = _create_projection_account(db_session)
    month = date(2026, 1, 1)
    committed = ErpCashProyectado(
        cuenta_cash_id=account.id,
        fecha_periodo=month,
        tipo=QUICK_EDIT_COMMITTED_TYPE,
        importe=Decimal("100"),
        observacion="Original",
    )
    db_session.add_all(
        [
            ErpCashPeriodo(fecha_periodo=month, estado="CERRADO"),
            committed,
        ]
    )
    db_session.commit()
    committed_values = {
        period: (Decimal("0"), None) for period in projection_months(2026)
    }
    committed_values[month] = (Decimal("999"), "Modificado")

    result = save_projection_quick_edit(
        db_session,
        account.id,
        2026,
        {period: Decimal("0") for period in projection_months(2026)},
        committed_values=committed_values,
    )

    db_session.refresh(committed)
    assert committed.importe == Decimal("100")
    assert committed.observacion == "Original"
    assert result["committed_skipped_closed"] == 1
