from sqlmodel import create_engine, Session, SQLModel
from typing import Generator
import os

# Configuración de base de datos
# Usando dev.db en la carpeta data para separar entornos
DATABASE_URL = "sqlite:///./data/dev.db"

# Crear directorio data si no existe
os.makedirs("data", exist_ok=True)

engine = create_engine(DATABASE_URL, echo=False)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
