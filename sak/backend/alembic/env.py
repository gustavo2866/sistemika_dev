# migrations/env.py
from logging.config import fileConfig
import os

from alembic import context
from sqlalchemy import engine_from_config, pool

# --- (1) Cargar .env en desarrollo (no afecta prod) ---
try:
    from dotenv import load_dotenv, find_dotenv  # pip install python-dotenv
    load_dotenv(find_dotenv(), override=False)
except Exception:
    # Si no está instalado (por ejemplo en prod/CI), seguimos igual
    pass

# --- (2) Config de Alembic / logging ---
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- (3) Importar modelos / MetaData para autogenerate ---
from app.models import Base, User, Item, Paises  # ajustá estos imports a tu proyecto
target_metadata = Base.metadata

# --- (4) Leer DATABASE_URL del entorno y setearla en Alembic ---
db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise RuntimeError(
        "DATABASE_URL no está seteado. Definilo en .env (dev) o como env var (staging/prod)."
    )
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Modo 'offline': usa URL directa sin crear Engine."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # detectar cambios de tipos/length
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Modo 'online': crea Engine y asocia conexión."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # detectar cambios de tipos/length
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

