from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import User


def test_auth_flow(client: TestClient, db_session: Session) -> None:
    email = f"auth-{uuid4().hex[:8]}@example.com"
    user = User(nombre="Auth User", email=email)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    login_response = client.post(
        "/api/auth/login",
        json={"username": email, "password": "any"},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["token"]

    headers = {"Authorization": f"Bearer {token}"}

    me_response = client.get("/api/auth/me", headers=headers)
    assert me_response.status_code == 200
    me_body = me_response.json()
    assert me_body["email"] == email

    check_response = client.get("/api/auth/check", headers=headers)
    assert check_response.status_code == 200
    assert check_response.json()["authenticated"] is True

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200
