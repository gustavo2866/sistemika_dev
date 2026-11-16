from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import (
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
    db_session.add(ErpCashProyectado(
        cuenta_cash_id=account.id,
        fecha_periodo=date(2026, 1, 1),
        importe_comprometido=Decimal("750000"),
        importe_pendiente=Decimal("250000"),
        observacion="Orden confirmada",
    ))
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
    assert {item["importe_proyectado"] for item in result["values"]} == {1750000.0}
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


def _manual_calculation_case(session):
    account = _create_projection_account(session)
    session.add(ErpCashPeriodo(fecha_periodo=date(2025, 12, 1), estado="CERRADO"))
    _add_real(session, account_id=account.id, source_id=999, month=date(2025, 12, 15), value=Decimal("100"))
    manual = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 1, 1),
        importe_proyectado=999, origen_proyectado="MANUAL", importe_comprometido=7, observacion="Conservar",
        id_metodo_proyeccion=account.id_metodo_proyeccion)
    automatic = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 2, 1),
        importe_proyectado=1, origen_proyectado="CALCULADO")
    session.add_all([manual, automatic])
    session.commit()
    return account, manual, automatic


def _historical_reference_case(session):
    account = _create_projection_account(session)
    for month in (7, 8, 9):
        session.add(ErpCashPeriodo(fecha_periodo=date(2026, month, 1), estado="CERRADO"))
        _add_real(session, account_id=account.id, source_id=500 + month,
            month=date(2026, month, 15), value=Decimal(100 * (month - 6)))
        session.add(ErpCashProyectado(cuenta_cash_id=account.id,
            fecha_periodo=date(2026, month, 1), importe_proyectado=month * 10,
            importe_pendiente=7, origen_proyectado="CALCULADO"))
    session.add(ErpCashPeriodo(fecha_periodo=date(2026, 10, 1), estado="EN_CIERRE"))
    session.commit()
    return account


def test_desde_historico_usa_reales_anteriores_y_proyectados_del_rango_sin_persistir(db_session):
    account = _historical_reference_case(db_session)
    default = calculate_projection_quick_edit(db_session, account.id,
        period_from=date(2026, 10, 1), period_to=date(2026, 10, 1))
    assert default["values"][0]["importe_proyectado"] == 300
    result = calculate_projection_quick_edit(db_session, account.id,
        reference_from=date(2026, 8, 1), period_from=date(2026, 8, 1), period_to=date(2026, 10, 1))
    assert [row["importe_proyectado"] for row in result["values"]] == [100, 100, 100]
    assert result["values"][0]["parametros"]["valores_base"][0]["origen"] == "REAL_CUENTA_CASH"
    assert result["values"][1]["parametros"]["valores_base"][0]["origen"] == "PROYECTADO_CALCULADO"
    rows = db_session.exec(select(ErpCashProyectado).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert [row.importe_proyectado for row in rows] == [70, 80, 90]


def test_desde_historico_conserva_valor_manual_sin_guardar_como_base(db_session):
    account = _historical_reference_case(db_session)
    result = calculate_projection_quick_edit(db_session, account.id,
        reference_from=date(2026, 8, 1), period_from=date(2026, 8, 1), period_to=date(2026, 10, 1),
        preview_values={date(2026, 8, 1): (Decimal("55"), "MANUAL")})
    assert [row["importe_proyectado"] for row in result["values"]] == [55, 55, 55]
    assert result["values"][0]["origen_proyectado"] == "MANUAL"


def test_guardado_historico_exige_confirmacion_y_conserva_estado_reales_y_pendientes(db_session):
    from app.services.cash_projection_horizon import get_projection_horizon
    account = _historical_reference_case(db_session)
    values = {month: Decimal("111") for month in projection_months(db_session)}
    with pytest.raises(ValueError, match="Confirmar"):
        save_projection_quick_edit(db_session, account.id, None, values, reference_from=date(2026, 8, 1))
    result = save_projection_quick_edit(db_session, account.id, None, values,
        committed_values={month: (Decimal("9"), "Setup") for month in values},
        pending_values={month: Decimal("999") for month in values},
        projection_origins={month: "MANUAL" for month in values},
        reference_from=date(2026, 8, 1), historical_confirmed=True)
    assert result["updated"] == 2
    rows = db_session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.fecha_periodo <= date(2026, 9, 1)).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert [row.importe_proyectado for row in rows] == [70, 111, 111]
    assert [row.importe_pendiente for row in rows] == [7, 7, 7]
    assert [row.importe_comprometido for row in rows] == [0, 9, 9]
    assert all(row.origen_proyectado == "MANUAL" for row in rows[1:])
    states = dict(db_session.exec(select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado)).all())
    assert states[date(2026, 9, 1)] == "CERRADO" and states[date(2026, 10, 1)] == "EN_CIERRE"
    horizon = get_projection_horizon(db_session)
    assert (horizon.start, horizon.end) == (date(2026, 10, 1), date(2028, 9, 1))
    assert len(db_session.exec(select(ErpCashDiario)).all()) == 3


@pytest.mark.parametrize("reference", [date(2025, 12, 1), date(2026, 11, 1), date(2026, 8, 2)])
def test_periodo_desde_rechaza_fuera_de_limites_y_fechas_no_mensuales(db_session, reference):
    account = _historical_reference_case(db_session)
    with pytest.raises(ValueError, match="Período desde"):
        calculate_projection_quick_edit(db_session, account.id, reference_from=reference)
    with pytest.raises(ValueError, match="Período desde"):
        save_projection_quick_edit(db_session, account.id, None, {}, reference_from=reference, historical_confirmed=True)


def test_api_previsualizacion_y_confirmacion_historica(db_session):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.db import get_session
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_router
    account = _historical_reference_case(db_session)
    app = FastAPI()
    app.include_router(erp_cash_proyectado_router)
    app.dependency_overrides[get_session] = lambda: db_session
    payload = {"periodo_referencia": "2026-08-01", "values": [
        {"periodo": month.isoformat(), "importe_proyectado": "55", "origen_proyectado": "MANUAL"}
        for month in projection_months(db_session) if month >= date(2026, 8, 1)]}
    with TestClient(app) as client:
        preview = client.post("/erp/cash/proyectado/quick-edit/calculate",
            params={"cuenta_cash_id": account.id}, json=payload)
        assert preview.status_code == 200, preview.text
        assert preview.json()["values"][0]["periodo"] == "2026-08-01"
        denied = client.put("/erp/cash/proyectado/quick-edit/values", params={"cuenta_cash_id": account.id}, json=payload)
        assert denied.status_code == 400
        payload["confirmar_historico"] = True
        saved = client.put("/erp/cash/proyectado/quick-edit/values", params={"cuenta_cash_id": account.id}, json=payload)
        assert saved.status_code == 200, saved.text


def test_calcular_conserva_manual_y_coincide_con_actualizar(db_session):
    from app.services.cash_projection_generation_service import recalculate_cash_projections
    account, manual, automatic = _manual_calculation_case(db_session)
    before = manual.version
    result = calculate_projection_quick_edit(db_session, account.id,
        period_from=date(2026, 1, 1), period_to=date(2026, 3, 1))
    assert [item["importe_proyectado"] for item in result["values"]] == [999, 999, 999]
    assert [item["origen_proyectado"] for item in result["values"]] == ["MANUAL", "CALCULADO", "CALCULADO"]
    db_session.refresh(automatic)
    assert automatic.importe_proyectado == 1  # Calcular es una previsualización.
    recalculate_cash_projections(db_session, date(2026, 1, 1), date(2026, 3, 1))
    rows = db_session.exec(select(ErpCashProyectado).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert [row.importe_proyectado for row in rows] == [999, 999, 999]
    assert (manual.version, manual.importe_comprometido, manual.observacion) == (before, 7, "Conservar")


@pytest.mark.parametrize("origin,amount,expected", [("MANUAL", 345, 345), ("CALCULADO", 999, 100)])
def test_calcular_usa_toggle_y_valor_sin_guardar_para_meses_dependientes(db_session, origin, amount, expected):
    account, manual, automatic = _manual_calculation_case(db_session)
    result = calculate_projection_quick_edit(db_session, account.id,
        period_from=date(2026, 1, 1), period_to=date(2026, 3, 1),
        preview_values={date(2026, 1, 1): (Decimal(amount), origin)})
    assert [item["importe_proyectado"] for item in result["values"]] == [expected] * 3
    assert result["values"][0]["origen_proyectado"] == origin
    db_session.refresh(manual)
    db_session.refresh(automatic)
    assert (manual.importe_proyectado, manual.origen_proyectado) == (999, "MANUAL")
    assert automatic.importe_proyectado == 1


def test_api_calcular_acepta_manual_sin_guardar_y_no_persiste(db_session):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.db import get_session
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_router
    account, manual, _ = _manual_calculation_case(db_session)
    app = FastAPI()
    app.include_router(erp_cash_proyectado_router)
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as client:
        response = client.post("/erp/cash/proyectado/quick-edit/calculate", params={
            "cuenta_cash_id": account.id, "periodo_desde": "2026-01-01", "periodo_hasta": "2026-03-01",
        }, json={"values": [{"periodo": "2026-01-01", "importe_proyectado": "456.78", "origen_proyectado": "MANUAL"}]})
    assert response.status_code == 200, response.text
    assert [item["importe_proyectado"] for item in response.json()["values"]] == [456.78] * 3
    db_session.refresh(manual)
    assert manual.importe_proyectado == 999


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
        month: (Decimal("0"), None) for month in projection_months(db_session)
    }
    committed_values[date(2026, 1, 1)] = (
        Decimal("500000"),
        "Compra comprometida",
    )
    pending_values = {
        month: Decimal("0") for month in projection_months(db_session)
    }
    pending_values[date(2026, 1, 1)] = Decimal("250000")
    result = save_projection_quick_edit(
        db_session,
        account.id,
        2026,
        {month: Decimal("0") for month in projection_months(db_session)},
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
            ErpCashProyectado.importe_comprometido != 0,
        )
    ).one()
    assert committed.importe_comprometido == Decimal("500000")
    assert committed.observacion == "Compra comprometida"
    pending = db_session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.cuenta_cash_id == account.id,
            ErpCashProyectado.fecha_periodo == date(2026, 1, 1),
            ErpCashProyectado.importe_pendiente != 0,
        )
    ).one()
    assert pending.importe_pendiente == Decimal("250000")
    assert result["created"] == 24


def test_guardar_no_modifica_comprometido_de_un_periodo_cerrado(
    db_session: Session,
):
    account = _create_projection_account(db_session)
    month = date(2026, 1, 1)
    committed = ErpCashProyectado(
        cuenta_cash_id=account.id,
        fecha_periodo=month,
        importe_comprometido=Decimal("100"),
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
        period: (Decimal("0"), None) for period in projection_months(db_session)
    }
    committed_values[month] = (Decimal("999"), "Modificado")

    result = save_projection_quick_edit(
        db_session,
        account.id,
        2026,
        {period: Decimal("0") for period in projection_months(db_session)},
        committed_values=committed_values,
    )

    db_session.refresh(committed)
    assert committed.importe_comprometido == Decimal("100")
    assert committed.observacion == "Original"
    assert result["skipped_closed"] == 1


def test_metodo_pendiente_conserva_otros_importes_e_historico(db_session):
    account = _create_projection_account(db_session)
    pending_method = MetodoProyeccion(nombre="Pendiente", tipo_calculo="PENDIENTE")
    db_session.add(pending_method)
    db_session.flush()
    closed = ErpCashProyectado(
        cuenta_cash_id=account.id, fecha_periodo=date(2026, 1, 1),
        id_metodo_proyeccion=account.id_metodo_proyeccion,
        importe_proyectado=Decimal("100"), importe_pendiente=Decimal("25"),
        importe_comprometido=Decimal("10"),
    )
    db_session.add_all([closed, ErpCashPeriodo(fecha_periodo=closed.fecha_periodo, estado="CERRADO")])
    db_session.commit()
    months = projection_months(db_session)
    save_projection_quick_edit(
        db_session, account.id, 2026,
        {month: Decimal("200") for month in months}, pending_method.id,
        {month: (Decimal("30"), None) for month in months},
        {month: Decimal("50") for month in months},
    )
    rows = db_session.exec(select(ErpCashProyectado).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert len(rows) == len(months)
    assert rows[0].tipo_calculo == "HISTORICO"
    assert rows[0].total_proyectado == Decimal("110")
    assert rows[1].importe_proyectado == Decimal("200")
    assert rows[1].importe_pendiente == Decimal("50")
    assert rows[1].total_proyectado == Decimal("80")
    result = get_projection_quick_edit(db_session, account.id, 2026)
    assert result["values"][0]["total_proyectado"] == 110
    assert result["values"][1]["total_proyectado"] == 80


def test_guardado_invalido_revierte_importes_y_cambio_de_metodo(db_session):
    import pytest

    account = _create_projection_account(db_session)
    db_session.commit()
    original_id = account.id_metodo_proyeccion
    method = MetodoProyeccion(nombre="Pendiente", tipo_calculo="PENDIENTE")
    db_session.add(method)
    db_session.commit()
    values = {month: Decimal("100") for month in projection_months(db_session)}
    values[date(2026, 2, 1)] = Decimal("NaN")
    with pytest.raises(ValueError, match="finito"):
        save_projection_quick_edit(db_session, account.id, 2026, values, method.id)
    db_session.refresh(account)
    assert account.id_metodo_proyeccion == original_id
    assert db_session.exec(select(ErpCashProyectado)).all() == []


def test_edicion_rapida_conserva_y_actualiza_el_origen_del_importe(db_session):
    account = _create_projection_account(db_session)
    db_session.commit()
    months = projection_months(db_session)
    values = {month: Decimal("100") for month in months}
    save_projection_quick_edit(db_session,account.id,2026,values,
        projection_origins={month:"CALCULADO" for month in months})
    assert get_projection_quick_edit(db_session,account.id,2026)["values"][0]["origen_proyectado"] == "CALCULADO"
    values[months[0]]=Decimal("250")
    save_projection_quick_edit(db_session,account.id,2026,values)
    result=get_projection_quick_edit(db_session,account.id,2026)
    assert result["values"][0]["origen_proyectado"] == "MANUAL"
    assert result["values"][1]["origen_proyectado"] == "CALCULADO"
