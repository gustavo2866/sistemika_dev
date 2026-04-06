"""
Configuración de pytest para tests unitarios.

Registra JSONB como JSON en SQLite para que los modelos que usan JSONB de
PostgreSQL funcionen con el engine SQLite in-memory usado en los tests.
"""
from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from importlib import import_module
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("JWT_SECRET", "test-secret")

# Parchar SQLite para aceptar JSONB (lo trata como JSON texto).
# Debe hacerse ANTES de importar los modelos que usan JSONB.
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler  # noqa: E402

SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"  # type: ignore[attr-defined]

import pytest  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402

# Importar todos los modelos para que SQLModel.metadata los registre
import_module("app.models")
import_module("agente.v2.db.models")


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Sesión SQLite in-memory con todas las tablas SQLModel registradas."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)
