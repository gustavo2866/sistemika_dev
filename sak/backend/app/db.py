import os
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine

DEFAULT_DB_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/sak"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

echo_flag = os.getenv("SQLALCHEMY_ECHO", "0") == "1"
engine = create_engine(
    DATABASE_URL,
    echo=echo_flag,
    pool_pre_ping=True,
)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def init_db() -> None:
    try:
        import app.models  # noqa: F401
    except Exception:
        pass
    SQLModel.metadata.create_all(engine)
