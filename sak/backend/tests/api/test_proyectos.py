from fastapi.testclient import TestClient


def test_create_and_list_proyectos(client: TestClient) -> None:
    payload = {
        "nombre": "Proyecto API",
        "estado": "planeado",
        "fecha_inicio": "2025-01-01",
        "importe_mat": "150000.50",
        "importe_mo": "50000.00",
        "comentario": "Proyecto de prueba automatizada",
    }

    create_response = client.post("/proyectos", json=payload)
    assert create_response.status_code == 201, create_response.text
    data = create_response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["estado"] == payload["estado"]
    assert float(data["importe_mat"]) == float(payload["importe_mat"])
    assert float(data["importe_mo"]) == float(payload["importe_mo"])

    list_response = client.get("/proyectos")
    assert list_response.status_code == 200
    records = list_response.json()
    assert any(item["nombre"] == payload["nombre"] for item in records)


def test_update_and_delete_proyecto(client: TestClient) -> None:
    create_payload = {
        "nombre": "Proyecto Temporal",
        "estado": "planeado",
        "fecha_inicio": "2025-02-10",
        "importe_mat": "200000.00",
        "importe_mo": "80000.00",
    }

    create_response = client.post("/proyectos", json=create_payload)
    assert create_response.status_code == 201
    created = create_response.json()
    proyecto_id = created["id"]

    update_payload = {
        "id": proyecto_id,
        "nombre": "Proyecto Temporal",
        "estado": "en_ejecucion",
        "fecha_inicio": "2025-02-10",
        "fecha_final": "2025-08-15",
        "importe_mat": "225000.00",
        "importe_mo": "92000.00",
        "comentario": "Se actualiza alcance y presupuesto",
    }

    update_response = client.put(f"/proyectos/{proyecto_id}", json=update_payload)
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["estado"] == "en_ejecucion"
    assert updated["fecha_final"] == "2025-08-15"
    detail_response = client.get(f"/proyectos/{proyecto_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["estado"] == "en_ejecucion"

    delete_response = client.delete(f"/proyectos/{proyecto_id}")
    assert delete_response.status_code == 200
    deleted = delete_response.json()
    assert deleted["id"] == proyecto_id
    assert deleted["nombre"] == update_payload["nombre"]
