# Base de datos - Setup verificado

Resumen elaborado a partir de `backend/docs/setup/database-local.md`, `backend/docs/setup/database-neon.md`, `README_DEPLOY.md`, `WORKFLOW_INFO.md` y scripts en `backend/scripts`.

> **💡 Primera vez?** Lee primero la guía completa: [Getting Started](getting-started.md)

## 1. PostgreSQL local

### Instalacion

- **Windows:** descargar instalador desde <https://www.postgresql.org/download/windows/> (version 14+). Incluye pgAdmin si necesitas GUI.
- **Ubuntu/Debian:**
  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
  ```
- **macOS (Homebrew):**
  ```bash
  brew install postgresql@14
  brew services start postgresql@14
  ```

### Crear base y usuario

```sql
psql -U postgres

CREATE DATABASE sak;
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;
\c sak
GRANT ALL ON SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sak_user;
\q
```

### Configurar `.env`

```env
DATABASE_URL=postgresql+psycopg://sak_user:<password>@localhost:5432/sak
SQLALCHEMY_ECHO=1
ENV=dev
```

### Verificacion

```bash
psql -U sak_user -d sak -h localhost -c "SELECT version();"
python -c "from sqlmodel import create_engine; create_engine('<DATABASE_URL>', echo=True).connect()"
```

## 2. Neon (produccion)

### Connection strings

- **Pooled (pgBouncer, uso diario):**
  ```
  postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
  ```
- **Directa (migraciones Alembic, sin pooler):**
  ```
  postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require
  ```

Guarda la URL en:

- GitHub Secret `DATABASE_URL`
- Variable de Cloud Run
- `.env.neon` local (no versionado) si necesitas conectarte desde tu maquina

### Cargar variables localmente

```powershell
Get-Content .env.neon | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
```

### Consideraciones

- Neon requiere `sslmode=require`.
- Usa `SQLALCHEMY_ECHO=0` para evitar costos adicionales.
- La base puede entrar en modo suspendido en el tier gratuito; la primera conexion puede tardar unos segundos.

## 3. Migraciones

1. Activa el venv (`doc/setup/backend.md`).
2. Ejecuta:
   ```bash
   alembic upgrade head
   ```
3. Si usas Neon, agrega `--url <DIRECT_URL>`.
4. Verifica:
   ```bash
   alembic history | tail
   alembic current
   ```

Los archivos de migracion viven en `backend/migrations` (o `backend/alembic/versions` en versiones nuevas).

## 4. Seed data

Script principal: `backend/scripts/seed_sak_backend.py`

```bash
python scripts/seed_sak_backend.py
```

El script crea:

- Usuario demo `demo@example.com`
- Articulos base definidos en `app/models/articulo.py`
- Una solicitud con detalles

El script es idempotente; puedes ejecutarlo cuantas veces necesites.

## 5. Backups y restore

### Exportar Neon

```bash
pg_dump "postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" > neon_backup.sql
```

### Restaurar en local

```bash
psql -U sak_user -d sak < neon_backup.sql
```

### Crear branch en Neon (opcional)

En el dashboard de Neon puedes crear un branch para pruebas sin afectar produccion. Usa el branch para QA y luego destruyelo cuando ya no haga falta.

## 6. Checklist de integridad

- `[ ]` `psql -U sak_user -d sak -c '\dt'` muestra las tablas esperadas.
- `[ ]` `SELECT COUNT(*) FROM users;` retorna al menos 1 registro despues del seed.
- `[ ]` `alembic current` apunta a la revision mas reciente.
- `[ ]` `DATABASE_URL` apunta al host correcto (local o Neon).
- `[ ]` En Cloud Run, `DATABASE_URL`, `OPENAI_API_KEY` y `JWT_SECRET` estan cargados como secretos.

## 7. Problemas comunes

| Problema | Solucion |
| -------- | -------- |
| `role "sak_user" does not exist` | Ejecuta nuevamente los comandos `CREATE USER` y `GRANT`. |
| `database "sak" does not exist` | Crea la base con `CREATE DATABASE sak;`. |
| `password authentication failed` | Asegura credenciales y revisa `pg_hba.conf` para conexiones locales. |
| `SSL connection is required` en Neon | Confirma que la URL tenga `?sslmode=require`. |
| `Too many connections` en Neon | Ajusta `pool_size` y `max_overflow` del engine en `app/db.py` o usa la URL pooled. |

## 8. Referencias

- `backend/docs/setup/database-local.md`
- `backend/docs/setup/database-neon.md`
- `README_DEPLOY.md`
- `WORKFLOW_INFO.md`
- `backend/scripts/seed_sak_backend.py`
