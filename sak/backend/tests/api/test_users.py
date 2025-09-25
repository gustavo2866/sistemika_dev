from fastapi.testclient import TestClient


def test_create_and_list_user(client: TestClient) -> None:
    payload = {
        "nombre": "Usuario API",
        "email": "usuario.api@example.com",
        "telefono": "123456789",
    }

    create_response = client.post("/users", json=payload)
    assert create_response.status_code == 201, create_response.json()
    data = create_response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["email"] == payload["email"]

    list_response = client.get("/users")
    assert list_response.status_code == 200
    records = list_response.json()
    assert any(item["email"] == payload["email"] for item in records)
