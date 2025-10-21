# Configuración y Seed de Base de Datos (PostgreSQL)

## 1. Crear base y usuario

```sql
CREATE DATABASE sak_backend;
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';
GRANT ALL PRIVILEGES ON DATABASE sak_backend TO sak_user;
ALTER DATABASE sak_backend OWNER TO sak_user;
```

## 2. Configurar `.env`

```
DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak_backend
```

## 3. Verificar conexión rápida (psql)

```bash
psql -h localhost -U sak_user -d sak_backend -c "SELECT 1;"
```

## 4. Crear tablas (automático)

Al iniciar la app FastAPI / Uvicorn se ejecuta `SQLModel.metadata.create_all(engine)` en `app/db.py`.

## 5. Sembrar datos (seed)

Script incluido: `backend/scripts/seed_sak_backend.py`

```bash
python backend/scripts/seed_sak_backend.py
```

Inserta:
- Usuario demo `demo@example.com`
- 10 artículos base
- 1 solicitud con 3 detalles

## 6. Prueba rápida de endpoints

```bash
curl http://127.0.0.1:8000/solicitudes/?limit=5
curl http://127.0.0.1:8000/articulos/?limit=5
```

## 7. Problemas comunes

| Error | Causa | Solución |
|-------|-------|----------|
| FATAL: no existe la base | No creada | Ejecutar CREATE DATABASE |
| password authentication failed | Credenciales malas | Revisar `.env` y usuario | 
| relation does not exist | Sin tablas | Asegurar que app arrancó o ejecutar seed tras arranque |

## 8. Regenerar todo (full reset)

```sql
DROP DATABASE sak_backend WITH (FORCE);
CREATE DATABASE sak_backend;
```
Luego volver a pasos 2–5.
