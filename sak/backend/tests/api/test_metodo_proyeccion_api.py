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
                "funcion": None,
                "factor": 1.0,
            },
        ],
    }

    response = client.post("/metodos-proyeccion", json=payload)
    assert response.status_code == 201, response.text

    data = response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["activo"] is True

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
    assert item["detalles"][2]["funcion"] is None

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


def test_create_metodo_proyeccion_with_cuentas(client) -> None:
    payload = {
        "nombre": "Método con cuentas asociadas",
        "descripcion": "Vincula una cuenta ERP por número de cuenta.",
        "activo": True,
        "cuentas": [
            {"nro_cuenta": 1234, "activo": True},
            {"nro_cuenta": 5678, "activo": True},
        ],
    }

    response = client.post("/metodos-proyeccion", json=payload)
    assert response.status_code == 201, response.text

    data = response.json()
    get_response = client.get(f"/metodos-proyeccion/{data['id']}")
    assert get_response.status_code == 200, get_response.text

    item = get_response.json()
    assert len(item["cuentas"]) == 2
    assert {cuenta["nro_cuenta"] for cuenta in item["cuentas"]} == {1234, 5678}
    assert all(cuenta["activo"] is True for cuenta in item["cuentas"])

    cuenta_existente = next(
        cuenta for cuenta in item["cuentas"] if cuenta["nro_cuenta"] == 1234
    )
    update_response = client.put(
        f"/metodos-proyeccion/{data['id']}",
        json={
            "nombre": item["nombre"],
            "descripcion": item["descripcion"],
            "activo": item["activo"],
            "cuentas": [
                {
                    "id": cuenta_existente["id"],
                    "nro_cuenta": 1234,
                    "activo": False,
                },
                {"nro_cuenta": 9012, "activo": True},
            ],
        },
    )
    assert update_response.status_code == 200, update_response.text

    cuentas_actualizadas = update_response.json()["cuentas"]
    assert {cuenta["nro_cuenta"] for cuenta in cuentas_actualizadas} == {1234, 9012}
    assert next(
        cuenta for cuenta in cuentas_actualizadas if cuenta["nro_cuenta"] == 1234
    )["activo"] is False
