# Backend FastAPI - Setup verificado

Basado en `README.md`, `backend/docs/setup/quickstart.md`, `backend/docs/development/running-locally.md`, `backend/docs/setup/database-local.md`, `backend/docs/setup/database-neon.md`, `SETUP_GCP_SECRET.md`, `SECURITY_GCP.md`, `WORKFLOW_INFO.md` y scripts `backend/scripts/seed_sak_backend.py`.

> **💡 Primera vez?** Lee primero la guía completa: [Getting Started](getting-started.md)

## 1. Prerrequisitos

- Python 3.11+
- PostgreSQL 14+ (local o acceso a Neon)
- `pip`, `virtualenv`, `psql`
- Acceso a los secretos (Neon, GCP, OpenAI, JWT)
- En Windows, PowerShell 7 recomendado

## 2. Crear entorno virtual

```powershell
cd sak/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Para Bash:

```bash
cd sak/backend
python -m venv .venv
source .venv/bin/activate
```

## 3. Instalar dependencias

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> Las dependencias incluyen FastAPI, SQLModel, Alembic, psycopg, google-cloud-storage y pytest (ver `backend/requirements.txt`).

## 4. Variables de entorno (`backend/.env`)

Crear el archivo (no se versiona) tomando como referencia `.env copy`. 

**Paso a paso:**

```bash
# Copiar template
cp ".env copy" .env

# O en PowerShell:
Copy-Item ".env copy" .env
```

> **💡 Generación de secrets:** Ver [Getting Started - Generar JWT_SECRET](getting-started.md#46-generar-jwt_secret)

Ejemplo seguro:

```env
# Base de datos
DATABASE_URL=postgresql+psycopg://sak_user:<password>@localhost:5432/sak
SQLALCHEMY_ECHO=1
ENV=dev

# API
CORS_ORIGINS=http://localhost:3000
MAX_UPLOAD_MB=10
ALLOWED_MIME=image/jpeg,image/png,image/gif,image/webp

# Seguridad
JWT_SECRET=<genera_un_secret_unico>

# Integraciones
OPENAI_API_KEY=<token_openai>
STORAGE_ROOT=./storage

# Google Cloud Storage (opcional en local)
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas
GCS_SIGNED_URL_SECONDS=86400
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
```

Notas:

- Usa `CORS_ORIGINS` con valores separados por `;` cuando necesites multiples dominios.
- `GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a un archivo ignorado (`gcp-credentials.json`). Ver cómo obtenerlo: [Guía GCP Credentials](../../SETUP_GCP_SECRET.md) o protege el archivo (`SECURITY_GCP.md`).
- No dejar valores reales de `OPENAI_API_KEY` o `JWT_SECRET` en archivos compartidos.
- Para generar `JWT_SECRET`: Ver [Getting Started](getting-started.md#46-generar-jwt_secret)

## 5. Migraciones y schema

1. Configura la base de datos (ver `doc/setup/database.md`).
2. Ejecuta migraciones:

```bash
alembic upgrade head
```

3. Verifica estado:

```bash
alembic current
alembic history --verbose | tail
```

Si migras contra Neon, usa la URL directa:

```bash
alembic upgrade head --url postgresql+psycopg://neondb_owner:<password>@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

## 6. Datos semilla

El script `backend/scripts/seed_sak_backend.py` es idempotente y crea datos demo (usuario `demo@example.com`, articulos, solicitud). Ejecutalo con el venv activo y `DATABASE_URL` apuntando a la base correcta:

```bash
python scripts/seed_sak_backend.py
```

Confirma en PostgreSQL:

```sql
SELECT email FROM users WHERE email='demo@example.com';
```

## 7. Ejecutar el backend

```bash
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

- `/health` debe responder `{"status":"healthy"}`.
- `/docs` expone Swagger con la version configurada en `API_VERSION` (por defecto `v1`).
- Usa `--log-level debug` si necesitas mas detalle.

## 8. Testing

```bash
pytest -v
```

- Las pruebas viven en `backend/tests`.
- Para enfocarse en una ruta, usar `pytest backend/tests/api/test_users.py -k create`.

## 9. Integraciones clave

### Google Cloud Storage

- Bucket principal: `sak-wcl-bucket`.
- Prefijo usado: `facturas/`.
- Configura el archivo `gcp-credentials.json` siguiendo `SETUP_GCP_SECRET.md`.
- En produccion no se define `GOOGLE_APPLICATION_CREDENTIALS`; Cloud Run usa Application Default Credentials.

### GitHub Actions / GCP

- Script `setup-github-secret.ps1` codifica la credencial y la guarda como `GCP_SA_KEY`.
- Workflow `Deploy to GCP Cloud Run` despliega desde `sak/backend` cuando hay push a `master`.

### OpenAI

- `OPENAI_API_KEY` se consume en `app/services/pdf_extraction_service.py`.
- Si no tienes clave, deja la variable vacia y evita ejecutar funciones que la necesiten.

## 10. Troubleshooting rapido

| Sintoma | Accion |
| ------- | ------ |
| `ModuleNotFoundError: app` | Verifica que estas dentro de `sak/backend` y que el venv esta activo. |
| `Could not connect to database` | Checa `DATABASE_URL`, que PostgreSQL este corriendo y que la IP tenga acceso (si usas Neon). |
| `alembic: command not found` | Activa el venv antes de ejecutar Alembic. |
| Cambios no se reflejan | Asegura `--reload` en Uvicorn y que guardaste el archivo. |
| Errores con GCS | Verifica `GCS_*` y que `gcp-credentials.json` exista o que la service account tenga permisos (`roles/storage.admin`). |

## 11. Referencias utiles

- `backend/docs/setup/quickstart.md`
- `backend/docs/development/running-locally.md`
- `backend/docs/setup/database-local.md`
- `backend/docs/setup/database-neon.md`
- `backend/scripts/seed_sak_backend.py`
- `SETUP_GCP_SECRET.md`, `SECURITY_GCP.md`, `WORKFLOW_INFO.md`
