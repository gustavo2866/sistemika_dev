from app.models.metodo_proyeccion import MetodoProyeccion


def test_create_metodo_proyeccion_with_detalles(client) -> None:
    payload = {
        "nombre": "Promedio móvil 6 meses",
        "descripcion": "Aplica el promedio de los últimos 6 meses al siguiente mes proyectado.",
        "activo": True,
        "detalles": [
            {
                "mes_destino": 3,
                "mes_base_desde": -6,
                "mes_base_hasta": -1,
                "funcion": "PROMEDIO",
                "factor": 1.08,
            },
            {
                "mes_destino": 6,
                "mes_base_desde": -3,
                "mes_base_hasta": -1,
                "funcion": "SUMA",
                "factor": 1.0,
            },
            {
                "mes_destino": 12,
                "mes_base_desde": -1,
                "mes_base_hasta": -1,
                "funcion": "ULTIMO",
                "factor": 1.0,
            },
        ],
    }

    response = client.post("/metodos-proyeccion", json=payload)
    assert response.status_code == 201, response.text

    data = response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["activo"] is True
    assert data["tipo_calculo"] == "HISTORICO"

    get_response = client.get(f"/metodos-proyeccion/{data['id']}")
    assert get_response.status_code == 200, get_response.text
    item = get_response.json()
    assert len(item["detalles"]) == 3
    assert item["detalles"][0]["mes_destino"] == 3
    assert item["detalles"][0]["funcion"] == "PROMEDIO"
    assert item["detalles"][0]["factor"] == 1.08
    assert item["detalles"][1]["mes_destino"] == 6
    assert item["detalles"][1]["funcion"] == "SUMA"
    assert item["detalles"][2]["mes_destino"] == 12
    assert item["detalles"][2]["funcion"] == "ULTIMO"

    update_payload = {
        "nombre": item["nombre"],
        "descripcion": item["descripcion"],
        "activo": item["activo"],
        "detalles": [
            {
                "id": detalle["id"],
                "mes_destino": detalle["mes_destino"],
                "mes_base_desde": -1,
                "mes_base_hasta": -1,
                "funcion": "ULTIMO",
                "factor": 1,
            }
            for detalle in item["detalles"]
        ],
    }

    update_response = client.put(
        f"/metodos-proyeccion/{data['id']}",
        json=update_payload,
    )
    assert update_response.status_code == 200, update_response.text

    updated_item = update_response.json()
    assert len(updated_item["detalles"]) == 3
    assert all(detalle["funcion"] == "ULTIMO" for detalle in updated_item["detalles"])


def test_relacional_sin_reglas_y_rechazo_de_ciclo_por_api(client, db_session) -> None:
    method = MetodoProyeccion(nombre="Relacional", tipo_calculo="RELACIONAL")
    db_session.add(method)
    db_session.commit()
    method_id = method.id
    item = client.get(f"/metodos-proyeccion/{method_id}").json()
    assert item["tipo_calculo"] == "RELACIONAL"
    assert item.get("detalles", []) == []
    assert "cuentas" not in item
    response = client.post("/erp/cash/cuentas", json={"descripcion": "Alquileres", "tipo": "Ingreso"})
    assert response.status_code == 201, response.text
    rent = response.json()
    response = client.post("/erp/cash/cuentas", json={"descripcion": "Comisiones", "tipo": "Egreso",
        "id_metodo_proyeccion": method_id, "cuenta_cash_referencia_id": rent["id"], "porcentaje": 5})
    assert response.status_code == 201, response.text
    fees = response.json()
    response = client.put(f"/erp/cash/cuentas/{rent['id']}", json={
        "id_metodo_proyeccion": method_id, "cuenta_cash_referencia_id": fees["id"], "porcentaje": 20})
    assert response.status_code == 400, response.text
    assert "Dependencia circular" in response.text
    assert "Alquileres" in response.text and "Comisiones" in response.text
    unchanged = client.get(f"/erp/cash/cuentas/{rent['id']}").json()
    assert unchanged["id_metodo_proyeccion"] is None
    assert unchanged["cuenta_cash_referencia_id"] is None
    assert unchanged["descripcion"] == rent["descripcion"]


def test_tipos_son_solo_lectura_y_especiales_solo_por_seed(client, db_session):
    for kind in ("RELACIONAL", "PENDIENTE"):
        response = client.post("/metodos-proyeccion", json={"nombre": kind, "tipo_calculo": kind})
        assert response.status_code == 400
        assert "Históricos" in response.json()["detail"]["error"]["message"]
    method = MetodoProyeccion(nombre="Pendientes", tipo_calculo="PENDIENTE")
    db_session.add(method)
    db_session.commit()
    response = client.put(f"/metodos-proyeccion/{method.id}", json={"tipo_calculo": "RELACIONAL"})
    assert response.status_code == 400
    assert "solo lectura" in response.text
    response = client.put(f"/metodos-proyeccion/{method.id}", json={"descripcion": "Descripción editable"})
    assert response.status_code == 200, response.text
    assert response.json()["tipo_calculo"] == "PENDIENTE"
