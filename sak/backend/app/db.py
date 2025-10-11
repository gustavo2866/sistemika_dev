# app/db.py
import os
from typing import Generator, Iterator, Optional
from dotenv import load_dotenv

from sqlmodel import SQLModel, Session, create_engine

# Cargar variables de entorno desde .env
load_dotenv()

ENV: str = os.getenv("ENV", "dev")  # dev | staging | prod

# 1) URL: una sola fuente de verdad
DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if ENV == "dev":
        # Fallback solo en desarrollo (útil para modo avión)
        DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/sak"
    else:
        raise RuntimeError("DATABASE_URL no está definida")

# 2) Flags
ECHO = os.getenv("SQLALCHEMY_ECHO", "0") == "1"

# 3) Pooling & SSL (Neon suele requerir SSL)
#    Para psycopg3 podés pasar sslmode por connect_args o en la URL (?sslmode=require)
connect_args = {}
if "neon.tech" in DATABASE_URL and "sslmode=" not in DATABASE_URL:
    connect_args["sslmode"] = "require"

engine = create_engine(
    DATABASE_URL,
    echo=ECHO,
    pool_pre_ping=True,      # detecta conexiones muertas
    pool_size=5,             # ajustá según tu carga
    max_overflow=5,          # burst controlado
    pool_recycle=1800,       # recicla conexiones (seg)
    connect_args=connect_args,
    # future=True  # si quisieras forzar el estilo 2.x (opcional)
)

def get_session() -> Iterator[Session]:
    """Dependency para FastAPI."""
    with Session(engine) as session:
        yield session

def init_db() -> None:
    """
    Crea tablas solo en DEV cuando apuntás a una DB vacía.
    En STAGING/PROD, usá Alembic (alembic upgrade head).
    """
    if ENV == "dev" and os.getenv("ALLOW_CREATE_ALL", "0") == "1":
        # Asegurate de que los modelos estén importados
        try:
            import app.models  # noqa: F401
        except Exception:
            pass
        SQLModel.metadata.create_all(engine)
