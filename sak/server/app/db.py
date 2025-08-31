from sqlmodel import create_engine, Session, SQLModel
from typing import Generator

DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(DATABASE_URL, echo=False)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
