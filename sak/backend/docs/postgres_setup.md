# Configuracion de PostgreSQL

## 1. Crear base de datos y usuario

```sql
CREATE DATABASE sak;
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;
```

## 2. Configurar variables de entorno

Actualiza `.env` (o variables del sistema) con la cadena de conexion:

```
DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak
SQLALCHEMY_ECHO=0
```

## 3. Instalacion de dependencias

```bash
python -m venv .venv
. .venv/Scripts/activate   # En PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 4. Ejecutar migraciones y datos semilla

Las migraciones viven en `alembic/versions/`:

```bash
# Generar esquema inicial y datos semilla
alembic upgrade head
```

La revision `0001_initial_schema` crea todas las tablas desde los modelos de SQLModel
utilizando `SQLModel.metadata.create_all`. La revision `0002_seed_core_data` inserta
registros base (paises, tipo de operacion, proveedor y usuario demo).

## 5. Probar la API con pytest

```bash
pytest backend/tests/api
```

Los tests usan una base SQLite en memoria para verificar endpoints fundamentales
(`/health` y CRUD de usuarios) sin requerir PostgreSQL en el entorno de CI.

## 6. Ejecutar la API

```bash
uvicorn app.main:app --reload
```

Asegurate de que PostgreSQL este disponible antes de levantar la API en modo real.
