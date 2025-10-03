from collections.abc import Iterator
import os
import sys
from importlib import import_module
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("JWT_SECRET", "test-secret")

import_module("app.models")
from app.main import app as fastapi_app
from app.db import get_session
from app.services.tipo_comprobante_service import seed_default_tipos
from app.services.metodo_pago_service import seed_metodos_pago
from app.services.propiedad_service import seed_propiedades
from app.services.articulo_service import seed_articulos

APP_INSTANCE = fastapi_app


@pytest.fixture()
def test_engine() -> Iterator:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as seed_session:
        seed_default_tipos(seed_session)
        seed_metodos_pago(seed_session)
        seed_propiedades(seed_session)
        seed_articulos(seed_session)
    try:
        yield engine
    finally:
        SQLModel.metadata.drop_all(engine)


@pytest.fixture()
def db_session(test_engine) -> Iterator[Session]:
    with Session(test_engine) as session:
        yield session


@pytest.fixture()
def client(test_engine) -> Iterator[TestClient]:
    def override_session() -> Iterator[Session]:
        with Session(test_engine) as session:
            yield session

    APP_INSTANCE.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(APP_INSTANCE)
    finally:
        APP_INSTANCE.dependency_overrides.pop(get_session, None)
