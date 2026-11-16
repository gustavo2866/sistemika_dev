from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import MetodoProyeccion, MetodoProyeccionDetalle
from app.routers.erp_cash_cuenta_router import erp_cash_cuenta_crud as accounts
from app.routers.metodo_proyeccion_router import metodo_proyeccion_crud as methods
from app.models.erp.cash_proyectado_quick_edit import calculate_projection_quick_edit, get_projection_quick_edit, save_projection_quick_edit, projection_months
from app.services.cash_projection_service import CashProjectionEngine
from app.services.cash_projection_generation_service import recalculate_cash_projections


MONTH = date(2026, 3, 1)


def _special(session, name, kind):
    # Los métodos especiales se crean mediante seeds, no desde el CRUD.
    method = MetodoProyeccion(nombre=name, tipo_calculo=kind)
    session.add(method)
    session.commit()
    return method


def _chain(session):
    method = _special(session, "Relacional", "RELACIONAL")
    # Orden de IDs inverso al de dependencias.
    tax = accounts.create(session, {"descripcion": "Impuestos", "tipo": "Egreso"})
    fees = accounts.create(session, {"descripcion": "Comisiones", "tipo": "Egreso"})
    rent = accounts.create(session, {"descripcion": "Alquileres", "tipo": "Ingreso"})
    accounts.update(session, fees.id, {"id_metodo_proyeccion": method.id,
        "cuenta_cash_referencia_id": rent.id, "porcentaje": 5})
    accounts.update(session, tax.id, {"id_metodo_proyeccion": method.id,
        "cuenta_cash_referencia_id": fees.id, "porcentaje": 20})
    session.add(ErpCashProyectado(cuenta_cash_id=rent.id, fecha_periodo=MONTH, importe_proyectado=10000,
        importe_comprometido=999, origen_proyectado="MANUAL"))
    session.commit()
    return method, rent, fees, tax


def test_resuelve_cadena_del_mismo_mes_y_reutiliza_resultados(db_session):
    _, rent, fees, tax = _chain(db_session)
    engine = CashProjectionEngine(db_session)
    assert engine.calculate(tax.id, MONTH).projected_value == 100
    assert engine.calculate(fees.id, MONTH).projected_value == 500
    assert engine.calculate(tax.id, MONTH) is engine.cache[(tax.id, MONTH)]
    assert len(engine.cache) == 3
    assert engine.calculate(rent.id, MONTH).projected_value == 10000


def test_generacion_respeta_cadena_independiente_de_ids_y_conserva_manuales(db_session):
    _, rent, fees, tax = _chain(db_session)
    manual = ErpCashProyectado(cuenta_cash_id=fees.id, fecha_periodo=MONTH,
        importe_proyectado=700, importe_comprometido=9, observacion="Manual", origen_proyectado="MANUAL")
    db_session.add(manual)
    db_session.commit()
    stats = recalculate_cash_projections(db_session, MONTH, MONTH)
    db_session.commit()
    rows = {r.cuenta_cash_id: r for r in db_session.exec(select(ErpCashProyectado)).all()}
    assert rows[tax.id].importe_proyectado == 140
    assert rows[fees.id].importe_proyectado == 700
    assert rows[fees.id].importe_comprometido == 9
    assert rows[fees.id].observacion == "Manual"
    assert rows[tax.id].tipo_calculo == "RELACIONAL"
    assert stats["proyecciones_manuales_conservadas"] == 2


@pytest.mark.parametrize("reference", ["self", "indirect"])
def test_rechaza_ciclos_al_guardar_y_revierte_cambios(db_session, reference):
    method, rent, fees, tax = _chain(db_session)
    version = rent.version
    with pytest.raises(ValueError, match="Dependencia circular.*Alquileres"):
        accounts.update(db_session, rent.id, {"id_metodo_proyeccion": method.id,
            "cuenta_cash_referencia_id": rent.id if reference == "self" else tax.id, "porcentaje": 50})
    db_session.refresh(rent)
    assert rent.id_metodo_proyeccion is None
    assert rent.cuenta_cash_referencia_id is None
    assert rent.version == version


def test_motor_rechaza_ciclo_aun_si_se_introdujo_fuera_del_crud(db_session):
    method, rent, fees, tax = _chain(db_session)
    rent.id_metodo_proyeccion = method.id
    rent.cuenta_cash_referencia_id = tax.id
    rent.porcentaje = Decimal("10")
    db_session.add(rent)
    db_session.commit()
    with pytest.raises(ValueError, match="Dependencia circular"):
        CashProjectionEngine(db_session)


def test_tipo_de_metodo_es_inmutable_aunque_tenga_cuentas(db_session):
    method = _special(db_session, "Pendientes", "PENDIENTE")
    account = accounts.create(db_session, {"descripcion": "A", "id_metodo_proyeccion": method.id})
    with pytest.raises(ValueError, match="solo lectura"):
        methods.update(db_session, method.id, {"tipo_calculo": "RELACIONAL"})
    db_session.refresh(method)
    assert method.tipo_calculo == "PENDIENTE"


def test_cambio_de_tipo_es_rechazado_antes_de_modificar_dependencias(db_session):
    method, rent, fees, tax = _chain(db_session)
    pending = _special(db_session, "Otro", "PENDIENTE")
    rent.id_metodo_proyeccion = pending.id
    rent.cuenta_cash_referencia_id = tax.id
    rent.porcentaje = 10
    db_session.add(rent)
    db_session.commit()
    with pytest.raises(ValueError, match="solo lectura"):
        methods.update(db_session, pending.id, {"tipo_calculo": "RELACIONAL"})
    db_session.refresh(pending)
    assert pending.tipo_calculo == "PENDIENTE"


@pytest.mark.parametrize("payload", [
    {"tipo_calculo": "HISTORICO", "detalles": []},
    {"tipo_calculo": "RELACIONAL", "detalles": [{"mes_destino": 1}]},
    {"tipo_calculo": "PENDIENTE", "detalles": [{"mes_destino": 1}]},
])
def test_modalidades_validan_reglas_en_backend(db_session, payload):
    with pytest.raises(ValueError):
        methods.create(db_session, {"nombre": "Inválido", **payload})


@pytest.mark.parametrize("values", [{}, {"porcentaje": 5}, {"cuenta_cash_referencia_id": 999},
    {"cuenta_cash_referencia_id": 999, "porcentaje": 5}])
def test_relacional_exige_referencia_y_porcentaje(db_session, values):
    method = _special(db_session, "Relacional", "RELACIONAL")
    with pytest.raises(ValueError):
        accounts.create(db_session, {"descripcion": "Inválida", "id_metodo_proyeccion": method.id, **values})
    assert not db_session.exec(select(ErpCashCuenta)).all()


def test_referencia_pendiente_usa_pendiente_sin_comprometido(db_session):
    _, rent, fees, tax = _chain(db_session)
    pending = _special(db_session, "Pendientes", "PENDIENTE")
    accounts.update(db_session, rent.id, {"id_metodo_proyeccion": pending.id})
    row = db_session.exec(select(ErpCashProyectado).where(ErpCashProyectado.cuenta_cash_id == rent.id)).one()
    row.importe_pendiente = 2000
    db_session.add(row)
    db_session.commit()
    assert CashProjectionEngine(db_session).calculate(fees.id, MONTH).projected_value == 100


def test_edicion_rapida_calcula_relacional_y_no_guarda_ciclos(db_session):
    method, rent, fees, tax = _chain(db_session)
    result = calculate_projection_quick_edit(db_session, tax.id, 2026, period_from=MONTH, period_to=MONTH)
    assert result["values"][0]["importe_proyectado"] == 100
    assert result["values"][0]["parametros"]["tipo_calculo"] == "RELACIONAL"
    rent.cuenta_cash_referencia_id = tax.id
    rent.porcentaje = 5
    db_session.add(rent)
    db_session.commit()
    with pytest.raises(ValueError, match="Dependencia circular"):
        save_projection_quick_edit(db_session, rent.id, 2026,
            {m: Decimal("0") for m in projection_months(db_session)}, projection_method_id=method.id)
    db_session.refresh(rent)
    assert rent.id_metodo_proyeccion is None


def test_cadenas_historicas_y_relacionales_se_resuelven_mes_por_mes(db_session):
    _, rent, fees, tax = _chain(db_session)
    historical = methods.create(db_session, {"nombre": "Duplicar anterior", "tipo_calculo": "HISTORICO",
        "detalles": [{"mes_destino": month, "mes_base_desde": -1, "mes_base_hasta": -1,
            "funcion": "ULTIMO", "factor": 2} for month in (3, 4)]})
    accounts.update(db_session, rent.id, {"id_metodo_proyeccion": historical.id})
    march = db_session.exec(select(ErpCashProyectado).where(ErpCashProyectado.cuenta_cash_id == rent.id)).one()
    march.origen_proyectado = "CALCULADO"
    db_session.add(march)
    db_session.add(ErpCashProyectado(cuenta_cash_id=rent.id, fecha_periodo=date(2026, 2, 1),
        importe_proyectado=100, origen_proyectado="MANUAL"))
    db_session.commit()
    recalculate_cash_projections(db_session, MONTH, date(2026, 4, 1))
    db_session.commit()
    rows = {(r.cuenta_cash_id, r.fecha_periodo.month): r for r in db_session.exec(select(ErpCashProyectado)).all()}
    assert rows[(rent.id, 3)].importe_proyectado == 200
    assert rows[(rent.id, 4)].importe_proyectado == 400
    assert rows[(fees.id, 3)].importe_proyectado == 10
    assert rows[(fees.id, 4)].importe_proyectado == 20
    assert rows[(tax.id, 4)].importe_proyectado == 4


@pytest.mark.parametrize("percentage,expected", [(0, 0), (-5, -500), (Decimal("1.234567"), Decimal("123.46"))])
def test_porcentajes_cero_negativo_y_redondeo(db_session, percentage, expected):
    _, rent, fees, tax = _chain(db_session)
    accounts.update(db_session, fees.id, {"porcentaje": percentage})
    assert CashProjectionEngine(db_session).calculate(fees.id, MONTH).projected_value == expected


def test_cambio_a_pendiente_elimina_referencia_y_porcentaje(db_session):
    _, rent, fees, tax = _chain(db_session)
    pending = _special(db_session, "Pendientes", "PENDIENTE")
    accounts.update(db_session, fees.id, {"id_metodo_proyeccion": pending.id})
    db_session.refresh(fees)
    assert fees.cuenta_cash_referencia_id is None
    assert fees.porcentaje is None


def test_popup_previsualiza_referencia_y_factor_sin_modificar_la_cuenta(db_session):
    _, rent, fees, tax = _chain(db_session)
    result = calculate_projection_quick_edit(db_session, tax.id, 2026, period_from=MONTH, period_to=MONTH,
        relational_values={"cuenta_cash_referencia_id": rent.id, "porcentaje": Decimal("2.5")})
    assert result["values"][0]["importe_proyectado"] == 250
    assert result["values"][0]["parametros"]["factor"] == 0.025
    db_session.refresh(tax)
    assert tax.cuenta_cash_referencia_id == fees.id
    assert tax.porcentaje == 20
    assert db_session.exec(select(ErpCashProyectado).where(ErpCashProyectado.cuenta_cash_id == tax.id)).first() is None


def test_popup_guarda_metodo_referencia_factor_e_importes_en_una_transaccion(db_session):
    method, rent, fees, tax = _chain(db_session)
    account = accounts.create(db_session, {"descripcion": "Nueva cuenta", "tipo": "Egreso"})
    values = {m: Decimal("250") for m in projection_months(db_session)}
    save_projection_quick_edit(db_session, account.id, 2026, values, projection_method_id=method.id,
        relational_values={"cuenta_cash_referencia_id": rent.id, "porcentaje": Decimal("2.5")})
    result = get_projection_quick_edit(db_session, account.id, 2026)
    assert result["metodo_proyeccion_id"] == method.id
    assert result["cuenta_cash_referencia_id"] == rent.id
    assert result["porcentaje"] == 2.5
    assert result["values"][0]["importe_proyectado"] == 250


@pytest.mark.parametrize("invalid", ["cycle", "missing_reference", "missing_factor", "unknown_reference"])
def test_popup_rechaza_configuracion_invalida_sin_guardar_importes(db_session, invalid):
    method, rent, fees, tax = _chain(db_session)
    reference = tax.id if invalid == "cycle" else rent.id
    relational = {"cuenta_cash_referencia_id": reference, "porcentaje": Decimal("5")}
    if invalid == "missing_reference":
        relational["cuenta_cash_referencia_id"] = None
    if invalid == "missing_factor":
        relational["porcentaje"] = None
    if invalid == "unknown_reference":
        relational["cuenta_cash_referencia_id"] = 99999
    with pytest.raises(ValueError):
        calculate_projection_quick_edit(db_session, rent.id, 2026, projection_method_id=method.id,
            period_from=MONTH, period_to=MONTH, relational_values=relational)
    with pytest.raises(ValueError):
        save_projection_quick_edit(db_session, rent.id, 2026,
            {m: Decimal("999") for m in projection_months(db_session)}, projection_method_id=method.id,
            relational_values=relational)
    db_session.refresh(rent)
    assert rent.id_metodo_proyeccion is None
    row = db_session.exec(select(ErpCashProyectado).where(ErpCashProyectado.cuenta_cash_id == rent.id)).one()
    assert row.importe_proyectado == 10000
    assert row.fecha_periodo == MONTH


def test_api_popup_calcula_y_guarda_la_configuracion_relacional(db_session):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.db import get_session
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_router

    method, rent, fees, tax = _chain(db_session)
    target = accounts.create(db_session, {"descripcion": "Desde popup", "tipo": "Egreso"})
    app = FastAPI()
    app.include_router(erp_cash_proyectado_router)
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as client:
        response = client.post("/erp/cash/proyectado/quick-edit/calculate", params={
            "cuenta_cash_id": target.id, "anio": 2026, "metodo_proyeccion_id": method.id,
            "periodo_desde": MONTH.isoformat(), "periodo_hasta": MONTH.isoformat(),
            "cuenta_cash_referencia_id": rent.id, "porcentaje": "1.25"})
        assert response.status_code == 200, response.text
        assert response.json()["values"][0]["importe_proyectado"] == 125
        db_session.refresh(target)
        assert target.id_metodo_proyeccion is None
        payload = {"metodo_proyeccion_id": method.id, "cuenta_cash_referencia_id": rent.id,
            "porcentaje": "1.25", "values": [{"periodo": m.isoformat(), "importe_proyectado": "125"}
                for m in projection_months(db_session)]}
        response = client.put("/erp/cash/proyectado/quick-edit/values",
            params={"cuenta_cash_id": target.id, "anio": 2026}, json=payload)
        assert response.status_code == 200, response.text
        saved = client.get("/erp/cash/proyectado/quick-edit/values", params={"cuenta_cash_id": target.id, "anio": 2026}).json()
        assert saved["cuenta_cash_referencia_id"] == rent.id
        assert saved["porcentaje"] == 1.25
        payload["cuenta_cash_referencia_id"] = target.id
        response = client.put("/erp/cash/proyectado/quick-edit/values",
            params={"cuenta_cash_id": target.id, "anio": 2026}, json=payload)
        assert response.status_code == 400, response.text
        assert "circular" in response.text
        db_session.refresh(target)
        assert target.cuenta_cash_referencia_id == rent.id
