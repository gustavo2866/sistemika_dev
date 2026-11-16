from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import calculate_projection_quick_edit
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


@pytest.mark.parametrize("factor", ["-0.01", "1.01"])
def test_factor_fuera_de_rango_se_rechaza_al_configurar_y_calcular(db_session, factor):
    account = setup_case(db_session, factor=factor)
    with pytest.raises(ProjectionConfigurationError, match="entre 0 y 1"):
        calculate_cash_projection(db_session, cash_account_id=account.id, target_month=TARGET)
    with pytest.raises(ValueError, match="entre 0 y 1"):
        validate_method_rules("HISTORICO", [{"mes_destino": 4, "mes_base_desde": -1,
            "mes_base_hasta": -1, "funcion": "AJUSTE_PONDERADO", "factor": factor}])
