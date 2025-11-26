"""
Configuración de la sesión de base de datos
"""
from sqlmodel import create_engine, Session
from app.config import settings

# Crear engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.SQLALCHEMY_ECHO,
    pool_pre_ping=True,
)


def get_session():
    """
    Dependency para obtener sesión de base de datos
    """
    with Session(engine) as session:
        yield session
