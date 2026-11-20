from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import calculate_projection_quick_edit, projection_months
from app.models.metodo_proyeccion import FuncionProyeccion, MetodoProyeccion, MetodoProyeccionDetalle
from app.services.cash_projection_configuration import validate_method_rules
from app.services.cash_projection_generation_service import recalculate_cash_projections
from app.services.cash_projection_service import (
    ProjectionConfigurationError, ProjectionDataError, calculate_cash_projection, project_cash_account_range,
)

TARGET = date(2026, 4, 1)
BASE = date(2026, 3, 1)


def setup_case(session, *, state="CERRADO", projected="100", real="120", factor="0.25"):
    method = MetodoProyeccion(nombre="Ajuste ponderado")
    session.add(method)
    session.flush()
    for month in (4, 5, 6):
        session.add(MetodoProyeccionDetalle(id_metodo_proyeccion=method.id, mes_destino=month,
            mes_base_desde=-3, mes_base_hasta=-1, funcion=FuncionProyeccion.AJUSTE_PONDERADO,
            factor=Decimal(factor)))
    account = ErpCashCuenta(descripcion="Cobros ponderados", tipo="Ingreso", id_metodo_proyeccion=method.id)
    session.add(account)
    session.flush()
    session.add_all([
        ErpCashPeriodo(fecha_periodo=BASE, estado=state),
        ErpCashPeriodo(fecha_periodo=TARGET, estado="EN_CIERRE"),
        ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=BASE,
            importe_proyectado=Decimal(projected), origen_proyectado="MANUAL"),
    ])
    if real is not None:
        session.add(ErpCashDiario(source_id=1, empresa_id=1, fecha=BASE, periodo_anio=2026,
            periodo_mes=3, cuenta_codigo=100, cuenta_cash_id=account.id, debe=-Decimal(real), haber=0))
    session.commit()
    return account


@pytest.mark.parametrize("factor,projected,real,expected", [
    ("0.25", "100", "120", "105"), ("0", "100", "120", "100"),
    ("1", "100", "120", "120"), ("0.5", "100", "120", "110"),
    ("0.2", "-100", "-200", "-120"), ("0.25", "100", "0", "75"),
    ("0.25", "100", None, "100"),
    ("0.5", "100.01", "100.02", "100.02"),
])
def test_ajuste_usa_ultimo_mes_real_cerrado_y_no_multiplica_dos_veces(db_session, factor, projected, real, expected):
    account = setup_case(db_session, factor=factor, projected=projected, real=real)
    result = calculate_cash_projection(db_session, cash_account_id=account.id, target_month=TARGET)
    assert result.projected_value == Decimal(expected)
    assert result.base_value == Decimal(projected)
    assert result.function == FuncionProyeccion.AJUSTE_PONDERADO
    assert {item.month for item in result.base_values} == {BASE}
    assert len(result.base_values) == (1 if real is None else 2)


@pytest.mark.parametrize("state", ["ABIERTO", "EN_CIERRE"])
def test_referencia_no_cerrada_ignora_real_incluso_si_hay_movimientos(db_session, state):
    account = setup_case(db_session, state=state, real="100000")
    result = calculate_cash_projection(db_session, cash_account_id=account.id, target_month=TARGET)
    assert result.projected_value == 100
    assert len(result.base_values) == 1


def test_calcular_proyectar_y_actualizar_coinciden_y_respetan_manuales(db_session):
    account = setup_case(db_session)
    manual = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 5, 1),
        id_metodo_proyeccion=account.id_metodo_proyeccion, importe_proyectado=999,
        origen_proyectado="MANUAL", importe_comprometido=7, observacion="Conservar")
    # El real de abril todavía no está cerrado y debe ignorarse al calcular mayo.
    db_session.add_all([manual, ErpCashDiario(source_id=2, empresa_id=1, fecha=TARGET,
        periodo_anio=2026, periodo_mes=4, cuenta_codigo=100, cuenta_cash_id=account.id, debe=-50000, haber=0)])
    db_session.commit()
    projected = project_cash_account_range(db_session, cash_account_id=account.id,
        period_from=TARGET, period_to=date(2026, 6, 1))
    preview = calculate_projection_quick_edit(db_session, account.id,
        period_from=TARGET, period_to=date(2026, 6, 1))
    assert [item.projected_value for item in projected] == [105, 999, 999]
    assert [item["importe_proyectado"] for item in preview["values"]] == [105, 999, 999]
    assert len(db_session.exec(select(ErpCashProyectado)).all()) == 2
    recalculate_cash_projections(db_session, TARGET, date(2026, 6, 1))
    rows = db_session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.fecha_periodo >= TARGET).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert [row.importe_proyectado for row in rows] == [105, 999, 999]
    assert (manual.origen_proyectado, manual.importe_comprometido, manual.observacion) == ("MANUAL", 7, "Conservar")


def test_meses_futuros_mantienen_el_ultimo_ajuste(db_session):
    account = setup_case(db_session)
    rows = project_cash_account_range(db_session, cash_account_id=account.id,
        period_from=TARGET, period_to=date(2026, 6, 1))
    assert [row.projected_value for row in rows] == [105, 105, 105]


def test_rango_historico_usa_proyectado_editado_y_solo_real_cerrado(db_session):
    account = setup_case(db_session)
    result = calculate_projection_quick_edit(db_session, account.id,
        reference_from=BASE, period_from=BASE, period_to=TARGET,
        preview_values={BASE: (Decimal("200"), "MANUAL")})
    assert [item["importe_proyectado"] for item in result["values"]] == [200, 180]


def test_api_expone_nueva_funcion_y_traza_ambas_bases(db_session):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.db import get_session
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_router
    account = setup_case(db_session)
    app = FastAPI()
    app.include_router(erp_cash_proyectado_router)
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as client:
        response = client.post("/erp/cash/proyectado/quick-edit/calculate", params={
            "cuenta_cash_id": account.id, "periodo_desde": TARGET.isoformat(), "periodo_hasta": TARGET.isoformat(),
        })
    assert response.status_code == 200, response.text
    value = response.json()["values"][0]
    assert value["importe_proyectado"] == 105
    assert value["parametros"]["funcion"] == "AJUSTE_PONDERADO"
    assert [item["valor"] for item in value["parametros"]["valores_base"]] == [100, 120]


def test_falta_proyectado_de_referencia_informa_error(db_session):
    account = setup_case(db_session)
    row = db_session.exec(select(ErpCashProyectado)).one()
    db_session.delete(row)
    db_session.commit()
    with pytest.raises(ProjectionDataError) as error:
        calculate_cash_projection(db_session, cash_account_id=account.id, target_month=TARGET)
    assert error.value.missing_month == BASE


def _initial_history(session):
    method = MetodoProyeccion(nombre="Ajuste ponderado 15 histórico")
    session.add(method)
    session.flush()
    session.add_all([MetodoProyeccionDetalle(id_metodo_proyeccion=method.id,
        mes_destino=m, mes_base_desde=-1, mes_base_hasta=-1,
        funcion=FuncionProyeccion.AJUSTE_PONDERADO, factor=Decimal("0.15")) for m in range(1,13)])
    account = ErpCashCuenta(descripcion="Diversos histórico", tipo="Egreso", id_metodo_proyeccion=method.id)
    session.add(account)
    session.flush()
    for month, projected, real, state in [
        (1, "-13664056.44", "-8293103.94", "CERRADO"),
        (2, "-40701787.26", "-81730902.26", "CERRADO"),
        (3, "-52746726.47", "-30556498.97", "EN_CIERRE"),
    ]:
        session.add_all([
            ErpCashPeriodo(fecha_periodo=date(2026,month,1),estado=state),
            ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026,month,1),
                importe_proyectado=Decimal(projected), origen_proyectado="MANUAL"),
            ErpCashDiario(source_id=month, empresa_id=1, fecha=date(2026,month,1),
                periodo_anio=2026,periodo_mes=month,cuenta_codigo=100,cuenta_cash_id=account.id,
                debe=-Decimal(real),haber=0),
        ])
    session.commit()
    return account


def test_previsualizacion_usa_enero_editado_como_inicial_sin_referencia_dic25(db_session):
    account = _initial_history(db_session)
    result = calculate_projection_quick_edit(db_session,account.id,
        reference_from=date(2026,1,1),period_from=date(2026,1,1),period_to=date(2026,3,1),
        preview_values={date(2026,1,1):(Decimal("-100"),"CALCULADO"),
                        date(2026,2,1):(Decimal("0"),"CALCULADO"),
                        date(2026,3,1):(Decimal("0"),"CALCULADO")})
    assert result["values"][0]["importe_proyectado"] == -100
    assert result["values"][0]["parametros"]["valores_base"][0]["origen"] == "PROYECTADO_INICIAL"
    assert result["values"][1]["importe_proyectado"] == -1244050.59
    # La previsualización no guarda cambios ni exige que enero sea manual.
    jan = db_session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.cuenta_cash_id==account.id,ErpCashProyectado.fecha_periodo==date(2026,1,1))).one()
    assert jan.origen_proyectado == "MANUAL" and jan.importe_proyectado == Decimal("-13664056.44")


def test_boton_calcular_api_historico_desactiva_manuales_y_persiste_secuencia(db_session):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.db import get_session
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_router
    account = _initial_history(db_session)
    app = FastAPI()
    app.include_router(erp_cash_proyectado_router)
    app.dependency_overrides[get_session] = lambda: db_session
    jan = date(2026,1,1)
    payload = {"periodo_referencia": jan.isoformat(), "confirmar_historico":True,
        "metodo_proyeccion_id":None, "values":[{
            "periodo":month.isoformat(),
            "importe_proyectado":"-13664056.44" if month==jan else "-40701787.26",
            "origen_proyectado":"CALCULADO",
        } for month in projection_months(db_session)]}
    with TestClient(app) as client:
        for _ in range(2):
            response = client.put("/erp/cash/proyectado/quick-edit/values",
                params={"cuenta_cash_id":account.id,"calcular":True},json=payload)
            assert response.status_code == 200,response.text
            assert response.json()["calculated"] == len(payload["values"])
            fresh = client.get("/erp/cash/proyectado/quick-edit/values",params={"cuenta_cash_id":account.id}).json()
            assert [r["importe_proyectado"] for r in fresh["values"][:4]] == [
                -13664056.44,-12858413.57,-23189286.87,-23189286.87]
            assert all(r["origen_proyectado"]=="CALCULADO" for r in fresh["values"])
            assert all(r["id_metodo_proyeccion"]==account.id_metodo_proyeccion for r in fresh["values"])
    period = db_session.exec(select(ErpCashPeriodo).where(ErpCashPeriodo.fecha_periodo==jan)).one()
    assert period.estado == "CERRADO"


def test_ajuste_inicial_con_referencia_dic25_conserva_formula(db_session):
    account = _initial_history(db_session)
    db_session.add(ErpCashProyectado(cuenta_cash_id=account.id,fecha_periodo=date(2025,12,1),
        importe_proyectado=Decimal("-100"),origen_proyectado="MANUAL"))
    db_session.commit()
    result = calculate_projection_quick_edit(db_session,account.id,
        reference_from=date(2026,1,1),period_from=date(2026,1,1),period_to=date(2026,1,1),
        preview_values={date(2026,1,1):(Decimal("-999"),"CALCULADO")})
    assert result["values"][0]["importe_proyectado"] == -100
    assert result["values"][0]["parametros"]["valores_base"][0]["periodo"] == "2025-12-01"


@pytest.mark.parametrize("factor", ["-0.01", "1.01"])
def test_factor_fuera_de_rango_se_rechaza_al_configurar_y_calcular(db_session, factor):
    account = setup_case(db_session, factor=factor)
    with pytest.raises(ProjectionConfigurationError, match="entre 0 y 1"):
        calculate_cash_projection(db_session, cash_account_id=account.id, target_month=TARGET)
    with pytest.raises(ValueError, match="entre 0 y 1"):
        validate_method_rules("HISTORICO", [{"mes_destino": 4, "mes_base_desde": -1,
            "mes_base_hasta": -1, "funcion": "AJUSTE_PONDERADO", "factor": factor}])
