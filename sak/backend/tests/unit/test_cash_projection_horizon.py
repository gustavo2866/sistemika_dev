from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import get_projection_quick_edit, save_projection_quick_edit
from app.models.metodo_proyeccion import MetodoProyeccion, MetodoProyeccionDetalle
from app.routers.erp_cash_periodo_router import erp_cash_periodo_crud as periods
from app.services.cash_projection_horizon import get_projection_horizon, month_range
from app.services.erp_cash_rebuild_service import rebuild_cash


def setup_october(session):
    method = MetodoProyeccion(nombre="Pendientes", tipo_calculo="PENDIENTE")
    session.add(method)
    session.flush()
    account = ErpCashCuenta(descripcion="Cuenta móvil", tipo="Ingreso", id_metodo_proyeccion=method.id)
    session.add(account)
    session.flush()
    for month in range(1, 12):
        state = "CERRADO" if month < 10 else "EN_CIERRE" if month == 10 else "ABIERTO"
        session.add(ErpCashPeriodo(fecha_periodo=date(2026, month, 1), estado=state))
    historical = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 9, 1),
        importe_proyectado=111, importe_pendiente=222, importe_comprometido=7, observacion="Histórico")
    manual = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 11, 1),
        importe_proyectado=999, importe_comprometido=15, observacion="Manual", origen_proyectado="MANUAL")
    session.add_all([historical, manual])
    session.commit()
    return account, historical, manual


def test_editor_accumulates_history_and_ignores_panel_year(db_session):
    account, _, _ = setup_october(db_session)
    horizon = get_projection_horizon(db_session)
    assert (horizon.start, horizon.end) == (date(2026, 10, 1), date(2028, 9, 1))
    assert len(month_range(horizon.start, horizon.end)) == 24
    assert len(horizon.editor_months) == 33
    result = get_projection_quick_edit(db_session, account.id, 2030)
    assert result["values"][0]["periodo"] == "2026-01-01"
    assert result["values"][-1]["periodo"] == "2028-09-01"
    assert result["proyeccion_desde"] == "2026-10-01"
    assert len(result["values"]) == 33


def test_save_accepts_variable_history_and_keeps_historical_values(db_session):
    account, historical, _ = setup_october(db_session)
    horizon = get_projection_horizon(db_session)
    original = (historical.importe_proyectado, historical.importe_pendiente,
        historical.importe_comprometido, historical.observacion, historical.version)
    save_projection_quick_edit(db_session, account.id, 2020,
        {month: Decimal("30") for month in horizon.editor_months})
    db_session.refresh(historical)
    assert (historical.importe_proyectado, historical.importe_pendiente,
        historical.importe_comprometido, historical.observacion, historical.version) == original
    assert len(db_session.exec(select(ErpCashProyectado)).all()) == 25
    # También se admite guardar solo los 24 meses del horizonte.
    result = save_projection_quick_edit(db_session, account.id, None,
        {month: Decimal("40") for month in month_range(horizon.start, horizon.end)})
    assert result["updated"] == 24


def test_closing_extends_window_and_preserves_history_and_manuals(db_session):
    account, historical, manual = setup_october(db_session)
    snapshot = (historical.importe_proyectado, historical.importe_comprometido, historical.version)
    for month in (10, 11):
        period = db_session.exec(select(ErpCashPeriodo).where(
            ErpCashPeriodo.fecha_periodo == date(2026, month, 1))).one()
        periods.update(db_session, period.id, {"estado": "CERRADO"})
    # Sin otro abierto, el inicio es el mes posterior al último cerrado.
    periods.create(db_session, {"fecha_periodo": date(2026, 12, 1), "estado": "CERRADO"})
    horizon = get_projection_horizon(db_session)
    assert (horizon.start, horizon.end) == (date(2027, 1, 1), date(2028, 12, 1))
    assert len(horizon.editor_months) == 36
    db_session.refresh(historical)
    db_session.refresh(manual)
    assert (historical.importe_proyectado, historical.importe_comprometido, historical.version) == snapshot
    assert (manual.importe_proyectado, manual.importe_comprometido, manual.observacion) == (999, 15, "Manual")
    projected = db_session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.cuenta_cash_id == account.id,
        ErpCashProyectado.fecha_periodo >= horizon.start,
        ErpCashProyectado.fecha_periodo <= horizon.end)).all()
    assert len(projected) == 24
    assert max(row.fecha_periodo for row in projected) == date(2028, 12, 1)


def test_stale_editor_cannot_save_after_horizon_advances(db_session):
    account, _, _ = setup_october(db_session)
    stale = {month: Decimal("5") for month in get_projection_horizon(db_session).editor_months}
    october = db_session.exec(select(ErpCashPeriodo).where(
        ErpCashPeriodo.fecha_periodo == date(2026, 10, 1))).one()
    periods.update(db_session, october.id, {"estado": "CERRADO"})
    with pytest.raises(ValueError, match="recargá"):
        save_projection_quick_edit(db_session, account.id, 2026, stale)


def test_closure_rolls_back_when_projection_cannot_be_calculated(db_session):
    account, _, manual = setup_october(db_session)
    manual.origen_proyectado = "CALCULADO"
    db_session.add(manual)
    method = MetodoProyeccion(nombre="Histórico sin regla de diciembre")
    db_session.add(method)
    db_session.flush()
    for month in range(1, 12):
        db_session.add(MetodoProyeccionDetalle(id_metodo_proyeccion=method.id, mes_destino=month,
            mes_base_desde=-1, mes_base_hasta=-1, funcion="ULTIMO", factor=1))
    account.id_metodo_proyeccion = method.id
    db_session.add(account)
    db_session.commit()
    october = db_session.exec(select(ErpCashPeriodo).where(
        ErpCashPeriodo.fecha_periodo == date(2026, 10, 1))).one()
    with pytest.raises(ValueError):
        periods.update(db_session, october.id, {"estado": "CERRADO"})
    db_session.refresh(october)
    assert october.estado == "EN_CIERRE"
    assert len(db_session.exec(select(ErpCashProyectado)).all()) == 2


def test_default_rebuild_uses_rolling_horizon(db_session):
    account, _, _ = setup_october(db_session)
    october = db_session.exec(select(ErpCashPeriodo).where(
        ErpCashPeriodo.fecha_periodo == date(2026, 10, 1))).one()
    october.diario_cash_importado = october.mayor_cash_importado = True
    fund = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    db_session.add_all([october, fund])
    db_session.flush()
    from app.models.erp.cash_map import ErpCashMap
    db_session.add(ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fund.id, map_haber_id=fund.id))
    db_session.commit()
    result = rebuild_cash(db_session, "2026-10", actuals_to="2026-10")
    assert result["periodo_hasta"] == "2028-09"
    rows = db_session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.cuenta_cash_id == account.id, ErpCashProyectado.fecha_periodo >= date(2026, 10, 1))).all()
    assert len(rows) == 24


def test_http_contract_uses_server_range_and_accepts_history_beyond_24_rows(db_session):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.db import get_session
    from app.routers.erp_cash_diario_router import erp_cash_panel_router
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_router

    account, historical, _ = setup_october(db_session)
    app = FastAPI()
    app.include_router(erp_cash_panel_router)
    app.include_router(erp_cash_proyectado_router)
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as client:
        horizon = client.get("/erp/cash/projection-horizon")
        assert horizon.status_code == 200
        assert horizon.json()["proyeccion_hasta"] == "2028-09-01"
        params = {"cuenta_cash_id": account.id}
        response = client.get("/erp/cash/proyectado/quick-edit/values", params=params)
        assert response.status_code == 200
        values = response.json()["values"]
        assert len(values) == 33
        preview = client.post("/erp/cash/proyectado/quick-edit/calculate", params=params)
        assert preview.status_code == 200, preview.text
        assert len(preview.json()["values"]) == 24
        assert preview.json()["periodo_desde"] == "2026-10-01"
        assert len(db_session.exec(select(ErpCashProyectado)).all()) == 2
        saved = client.put("/erp/cash/proyectado/quick-edit/values", params=params, json={"values": values})
        assert saved.status_code == 200, saved.text
        assert saved.json()["proyeccion_hasta"] == "2028-09-01"
        db_session.refresh(historical)
        assert historical.importe_proyectado == 111
