from datetime import date

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import MetodoProyeccion
from app.services.cash_projection_horizon import get_projection_horizon
from app.services.erp_cash_rebuild_service import rebuild_cash
from app.services.erp_cash_sync_period_service import begin_cash_sync


def setup_periods(session):
    method = MetodoProyeccion(nombre="Pendientes", tipo_calculo="PENDIENTE")
    fund = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    session.add_all([method, fund])
    session.flush()
    account = ErpCashCuenta(descripcion="Cobros", tipo="Ingreso", id_metodo_proyeccion=method.id)
    session.add(account)
    october = ErpCashPeriodo(fecha_periodo=date(2026, 10, 1), estado="ABIERTO",
        diario_cash_importado=True, mayor_cash_importado=True)
    session.add_all([october,
        ErpCashPeriodo(fecha_periodo=date(2026, 9, 1), estado="CERRADO"),
        ErpCashPeriodo(fecha_periodo=date(2026, 11, 1), estado="ABIERTO"),
        ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fund.id, map_haber_id=fund.id),
    ])
    session.flush()
    manual = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 11, 1),
        importe_proyectado=123, importe_comprometido=7, observacion="Conservar", origen_proyectado="MANUAL")
    history = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 9, 1),
        importe_proyectado=321, importe_comprometido=9, observacion="Histórico", origen_proyectado="MANUAL")
    session.add_all([manual, history])
    session.commit()
    return october, manual, history


def test_iniciar_primer_abierto_lo_pone_en_cierre_sin_afectar_noviembre(db_session):
    october, _, _ = setup_periods(db_session)
    begin_cash_sync(db_session, "2026-10")
    db_session.refresh(october)
    assert october.estado == "EN_CIERRE" and october.cerrado_en is None
    version = october.version
    begin_cash_sync(db_session, "2026-10")
    db_session.refresh(october)
    assert october.version == version
    november = db_session.exec(select(ErpCashPeriodo).where(ErpCashPeriodo.fecha_periodo == date(2026, 11, 1))).one()
    assert november.estado == "ABIERTO"


@pytest.mark.parametrize("period", ["2026-09", "2026-11"])
def test_no_permite_iniciar_cerrado_ni_saltar_primer_no_cerrado(db_session, period):
    october, _, _ = setup_periods(db_session)
    with pytest.raises(ValueError, match="primer período no cerrado"):
        begin_cash_sync(db_session, period)
    db_session.refresh(october)
    assert october.estado == "ABIERTO"


def test_cierre_y_extension_de_24_meses_conservan_manuales_e_historia(db_session):
    october, manual, history = setup_periods(db_session)
    historical_values = (history.importe_proyectado, history.importe_comprometido, history.version)
    begin_cash_sync(db_session, "2026-10")
    result = rebuild_cash(db_session, "2026-10", actuals_to="2026-10", close_period=True)
    db_session.refresh(october)
    db_session.refresh(manual)
    db_session.refresh(history)
    assert october.estado == "CERRADO" and october.cerrado_en is not None
    assert result["periodo_cerrado"] == "2026-10"
    assert result["periodo_hasta"] == "2028-10"
    assert (history.importe_proyectado, history.importe_comprometido, history.version) == historical_values
    assert (manual.importe_proyectado, manual.importe_comprometido, manual.observacion) == (123, 7, "Conservar")
    horizon = get_projection_horizon(db_session)
    assert (horizon.start, horizon.end) == (date(2026, 11, 1), date(2028, 10, 1))
    periods = db_session.exec(select(ErpCashPeriodo).where(ErpCashPeriodo.fecha_periodo >= horizon.start)).all()
    assert len(periods) == 24 and all(row.estado == "ABIERTO" for row in periods)
    projections = db_session.exec(select(ErpCashProyectado).where(ErpCashProyectado.fecha_periodo >= horizon.start)).all()
    assert len(projections) == 24
    # Una confirmación repetida no puede cerrar noviembre ni volver a cerrar octubre.
    with pytest.raises(ValueError):
        rebuild_cash(db_session, "2026-10", "2026-10", close_period=True)
    assert get_projection_horizon(db_session).start == date(2026, 11, 1)
    begin_cash_sync(db_session, "2026-11")
    assert get_projection_horizon(db_session).start == date(2026, 11, 1)


def test_sin_casilla_mantiene_mes_en_cierre_y_mismo_horizonte(db_session):
    october, _, _ = setup_periods(db_session)
    begin_cash_sync(db_session, "2026-10")
    result = rebuild_cash(db_session, "2026-10")
    db_session.refresh(october)
    assert october.estado == "EN_CIERRE" and october.cerrado_en is None
    assert "periodo_cerrado" not in result
    assert get_projection_horizon(db_session).end == date(2028, 9, 1)


def test_fallo_extension_revierte_cierre_y_conserva_mes_en_cierre(db_session, monkeypatch):
    october, _, _ = setup_periods(db_session)
    begin_cash_sync(db_session, "2026-10")
    def fail(_):
        raise ValueError("Fallo al extender horizonte")
    monkeypatch.setattr("app.services.erp_cash_sync_period_service.ensure_projection_horizon", fail)
    with pytest.raises(ValueError, match="extender horizonte"):
        rebuild_cash(db_session, "2026-10", close_period=True)
    db_session.refresh(october)
    assert october.estado == "EN_CIERRE" and october.cerrado_en is None
    assert db_session.exec(select(ErpCashPeriodo).where(ErpCashPeriodo.fecha_periodo == date(2028, 10, 1))).first() is None
    assert len(db_session.exec(select(ErpCashProyectado)).all()) == 2


@pytest.mark.parametrize("invalid", ["not_started", "missing_book", "skip_month"])
def test_cierre_rechaza_mes_no_iniciado_libros_faltantes_y_saltos(db_session, invalid):
    october, _, _ = setup_periods(db_session)
    if invalid != "not_started":
        begin_cash_sync(db_session, "2026-10")
    if invalid == "missing_book":
        october.mayor_cash_importado = False
        db_session.add(october)
        db_session.commit()
    with pytest.raises(ValueError):
        rebuild_cash(db_session, "2026-11" if invalid == "skip_month" else "2026-10", close_period=True)
    db_session.refresh(october)
    assert october.estado != "CERRADO" and october.cerrado_en is None


def test_router_inicio_y_finalizacion_con_cierre(db_session):
    from app.routers.erp_cash_diario_router import start_erp_cash_sync, rebuild_erp_cash
    october, _, _ = setup_periods(db_session)
    assert start_erp_cash_sync({"periodo": "2026-10"}, db_session)["estado"] == "EN_CIERRE"
    result = rebuild_erp_cash({"periodo_desde": "2026-10", "periodo_reales_hasta": "2026-10",
        "cerrar_periodo": True}, db_session)
    assert result["periodo_cerrado"] == "2026-10"
    db_session.refresh(october)
    assert october.estado == "CERRADO"


@pytest.mark.parametrize("payload", [
    {"periodo_desde": "2026-10", "cerrar_periodo": "false"},
    {"periodo_desde": "2026-10", "cerrar_periodo": True, "incluir_cerrados": True},
])
def test_router_rechaza_opciones_de_cierre_invalidas(db_session, payload):
    from fastapi import HTTPException
    from app.routers.erp_cash_diario_router import rebuild_erp_cash
    with pytest.raises(HTTPException) as error:
        rebuild_erp_cash(payload, db_session)
    assert error.value.status_code == 400
