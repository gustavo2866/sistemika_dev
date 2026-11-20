from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import select

from app.db import get_session
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.metodo_proyeccion import MetodoProyeccion, MetodoProyeccionDetalle
from app.routers.metodo_proyeccion_router import metodo_proyeccion_router


@pytest.fixture()
def client(db_session):
    app = FastAPI()
    app.include_router(metodo_proyeccion_router)
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as client:
        yield client


def _source(session, **kwargs):
    method = MetodoProyeccion(nombre="Original", descripcion="Reglas originales", **kwargs)
    session.add(method)
    session.flush()
    session.add_all([
        MetodoProyeccionDetalle(id_metodo_proyeccion=method.id, mes_destino=1,
            mes_base_desde=-6, mes_base_hasta=-1, funcion="PROMEDIO", factor=Decimal("1.25")),
        MetodoProyeccionDetalle(id_metodo_proyeccion=method.id, mes_destino=2,
            mes_base_desde=-1, mes_base_hasta=-1, funcion="AJUSTE_PONDERADO", factor=Decimal("0.15")),
        MetodoProyeccionDetalle(id_metodo_proyeccion=method.id, mes_destino=3,
            mes_base_desde=-1, mes_base_hasta=-1, funcion="ULTIMO", factor=1,
            deleted_at=datetime.now(timezone.utc)),
    ])
    session.commit()
    return method


def test_duplica_configuracion_y_reglas_con_ids_propios_sin_reasignar_cuentas(client, db_session):
    source = _source(db_session)
    account = ErpCashCuenta(descripcion="Cobros", tipo="Ingreso", id_metodo_proyeccion=source.id)
    db_session.add(account)
    db_session.commit()
    response = client.post(f"/metodos-proyeccion/{source.id}/duplicar", json={"nombre":"  Mi copia  "})
    assert response.status_code == 201, response.text
    copy = response.json()
    assert copy["nombre"] == "Mi copia" and copy["id"] != source.id
    assert copy["descripcion"] == source.descripcion and copy["activo"] is True
    assert copy["tipo_calculo"] == "HISTORICO"
    rules = sorted(copy["detalles"], key=lambda row: row["mes_destino"])
    assert [(r["mes_destino"],r["mes_base_desde"],r["mes_base_hasta"],r["funcion"],r["factor"])
        for r in rules] == [(1,-6,-1,"PROMEDIO",1.25),(2,-1,-1,"AJUSTE_PONDERADO",0.15)]
    assert not {r["id"] for r in rules} & {r.id for r in source.detalles}
    assert all(r["id_metodo_proyeccion"] == copy["id"] for r in rules)
    assert client.get(f"/metodos-proyeccion/{copy['id']}").status_code == 200
    db_session.refresh(account)
    assert account.id_metodo_proyeccion == source.id
    rules[0]["factor"] = 2
    result = client.put(f"/metodos-proyeccion/{copy['id']}",json={"detalles":rules})
    assert result.status_code == 200,result.text
    db_session.expire_all()
    original = db_session.exec(select(MetodoProyeccionDetalle).where(
        MetodoProyeccionDetalle.id_metodo_proyeccion==source.id,
        MetodoProyeccionDetalle.mes_destino==1)).one()
    assert original.factor == Decimal("1.25")


@pytest.mark.parametrize("kind", ["RELACIONAL","PENDIENTE"])
def test_rechaza_duplicar_metodos_especiales(client,db_session,kind):
    source = MetodoProyeccion(nombre=kind,tipo_calculo=kind)
    db_session.add(source)
    db_session.commit()
    response=client.post(f"/metodos-proyeccion/{source.id}/duplicar",json={"nombre":"Copia especial"})
    assert response.status_code == 400
    assert db_session.exec(select(MetodoProyeccion).where(MetodoProyeccion.nombre=="Copia especial")).first() is None


@pytest.mark.parametrize("name,status", [("",422),("   ",422),("x"*201,422),("Original",409),("original",409)])
def test_rechaza_nombres_invalidos_o_repetidos_sin_crear_copia(client,db_session,name,status):
    source = _source(db_session)
    response = client.post(f"/metodos-proyeccion/{source.id}/duplicar",json={"nombre":name})
    assert response.status_code == status,response.text
    assert len(db_session.exec(select(MetodoProyeccion)).all()) == 1


def test_rechaza_origen_inexistente_o_eliminado(client,db_session):
    assert client.post("/metodos-proyeccion/999/duplicar",json={"nombre":"Copia"}).status_code == 404
    source = _source(db_session,deleted_at=datetime.now(timezone.utc))
    assert client.post(f"/metodos-proyeccion/{source.id}/duplicar",json={"nombre":"Copia"}).status_code == 404


def test_copia_preserva_estado_inactivo(client,db_session):
    source = _source(db_session,activo=False)
    response = client.post(f"/metodos-proyeccion/{source.id}/duplicar",json={"nombre":"Copia inactiva"})
    assert response.status_code == 201,response.text
    assert response.json()["activo"] is False
