# Inventario de Configuraciones - doc/setup

Este documento lista **todos los elementos cuya configuración se encuentra definida** en la documentación de `doc/setup/`.

---

## 📋 Índice de Configuraciones

### 1. **Backend (FastAPI)** - `backend.md`

#### 1.1 Entorno Python
- ✅ **Python 3.11+** (versión mínima requerida)
- ✅ **pip** (gestor de paquetes)
- ✅ **virtualenv** (entorno virtual)
- ✅ **PowerShell 7** (recomendado en Windows)

#### 1.2 Dependencias
- ✅ **requirements.txt** - Instalación completa documentada
  - FastAPI
  - SQLModel
  - Alembic
  - psycopg (PostgreSQL driver)
  - google-cloud-storage
  - pytest

#### 1.3 Variables de Entorno (`backend/.env`)
| Variable | Documentado | Tipo | Ejemplo |
|----------|-------------|------|---------|
| `DATABASE_URL` | ✅ | String | `postgresql+psycopg://sak_user:pass@localhost:5432/sak` |
| `SQLALCHEMY_ECHO` | ✅ | Integer | `1` (dev), `0` (prod) |
| `ENV` | ✅ | String | `dev`, `prod` |
| `CORS_ORIGINS` | ✅ | String (delimitado `;`) | `http://localhost:3000;https://app.vercel.app` |
| `MAX_UPLOAD_MB` | ✅ | Integer | `10` |
| `ALLOWED_MIME` | ✅ | String (delimitado `,`) | `image/jpeg,image/png,image/gif,image/webp` |
| `JWT_SECRET` | ✅ | String | Valor único generado |
| `OPENAI_API_KEY` | ✅ | String | `sk-proj-...` |
| `STORAGE_ROOT` | ✅ | Path | `./storage` |
| `GCS_PROJECT_ID` | ✅ | String | `sak-wcl` |
| `GCS_BUCKET_NAME` | ✅ | String | `sak-wcl-bucket` |
| `GCS_INVOICE_FOLDER` | ✅ | String | `facturas` |
| `GCS_SIGNED_URL_SECONDS` | ✅ | Integer | `86400` |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ | Path | `./gcp-credentials.json` |

#### 1.4 Base de Datos
- ✅ **Migraciones Alembic**
  - Comando: `alembic upgrade head`
  - Verificación: `alembic current`, `alembic history`
  - Directorio: `backend/migrations` o `backend/alembic/versions`

- ✅ **Seed Data**
  - Script: `backend/scripts/seed_sak_backend.py`
  - Contenido:
    - Usuario demo: `demo@example.com`
    - Artículos base
    - Solicitud con detalles

#### 1.5 Servidor Local
- ✅ **uvicorn**
  - Comando: `uvicorn app.main:app --reload --port 8000 --host 0.0.0.0`
  - Endpoints clave:
    - `/health` - Health check
    - `/docs` - Swagger UI

#### 1.6 Testing
- ✅ **pytest**
  - Comando: `pytest -v`
  - Directorio: `backend/tests`
  - Tests específicos: `pytest backend/tests/api/test_users.py -k create`

#### 1.7 Integraciones
- ✅ **Google Cloud Storage**
  - Bucket: `sak-wcl-bucket`
  - Prefijo: `facturas/`
  - Credenciales: `gcp-credentials.json`
  - Documentación relacionada: `SETUP_GCP_SECRET.md`, `SECURITY_GCP.md`

- ✅ **GitHub Actions**
  - Script: `setup-github-secret.ps1`
  - Secret: `GCP_SA_KEY`
  - Workflow: `Deploy to GCP Cloud Run`

- ✅ **OpenAI**
  - Servicio: `app/services/pdf_extraction_service.py`
  - Variable: `OPENAI_API_KEY`

---

### 2. **Base de Datos** - `database.md`

#### 2.1 PostgreSQL Local

##### Instalación
- ✅ **Windows**: Instalador desde postgresql.org (v14+)
- ✅ **Ubuntu/Debian**: 
  ```bash
  sudo apt install postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
  ```
- ✅ **macOS**: 
  ```bash
  brew install postgresql@14
  brew services start postgresql@14
  ```

##### Configuración
- ✅ **Base de datos**: `sak`
- ✅ **Usuario**: `sak_user`
- ✅ **Password**: Configurado por usuario
- ✅ **Permisos**:
  - `GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user`
  - `GRANT ALL ON SCHEMA public TO sak_user`
  - `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sak_user`
  - `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sak_user`

##### Verificación
- ✅ Comando: `psql -U sak_user -d sak -h localhost -c "SELECT version();"`
- ✅ Python test: `create_engine('<DATABASE_URL>', echo=True).connect()`

#### 2.2 Neon (Producción)

##### Connection Strings
| Tipo | URL | Uso |
|------|-----|-----|
| **Pooled** | `postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require` | Uso diario, pgBouncer |
| **Directa** | `postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require` | Migraciones Alembic |

##### Almacenamiento de URLs
- ✅ GitHub Secret: `DATABASE_URL`
- ✅ Variable Cloud Run
- ✅ `.env.neon` local (no versionado)

##### Consideraciones
- ✅ **SSL requerido**: `sslmode=require`
- ✅ **Echo deshabilitado**: `SQLALCHEMY_ECHO=0` (evitar costos)
- ✅ **Cold start**: Primera conexión puede tardar

#### 2.3 Migraciones
- ✅ **Comando**: `alembic upgrade head`
- ✅ **Con Neon**: `alembic upgrade head --url <DIRECT_URL>`
- ✅ **Verificación**:
  - `alembic history | tail`
  - `alembic current`
- ✅ **Directorio**: `backend/migrations` o `backend/alembic/versions`

#### 2.4 Seed Data
- ✅ **Script**: `backend/scripts/seed_sak_backend.py`
- ✅ **Idempotente**: Puede ejecutarse múltiples veces
- ✅ **Contenido**:
  - Usuario demo: `demo@example.com`
  - Artículos base (definidos en `app/models/articulo.py`)
  - Solicitud con detalles

#### 2.5 Backups y Restore

##### Exportar desde Neon
- ✅ Comando: `pg_dump "<POOLED_URL>" > neon_backup.sql`

##### Restaurar en Local
- ✅ Comando: `psql -U sak_user -d sak < neon_backup.sql`

##### Branch en Neon
- ✅ Dashboard de Neon permite crear branches para QA

#### 2.6 Checklist de Integridad
- ✅ `psql -U sak_user -d sak -c '\dt'` muestra tablas
- ✅ `SELECT COUNT(*) FROM users;` retorna ≥ 1 después del seed
- ✅ `alembic current` apunta a revisión más reciente
- ✅ `DATABASE_URL` apunta al host correcto
- ✅ En Cloud Run, secrets cargados: `DATABASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET`

---

### 3. **Frontend (Next.js)** - `frontend.md`

#### 3.1 Entorno Node.js
- ✅ **Node.js 20.x** (requerido por Next.js 15)
- ✅ **npm 10.x+**
- ✅ **Git**
- ✅ **Acceso a Vercel**

#### 3.2 Scripts npm
| Script | Comando | Propósito |
|--------|---------|-----------|
| `dev` | ✅ `npm run dev` | Servidor de desarrollo |
| `build` | ✅ `npm run build` | Build de producción |
| `start` | ✅ `npm run start` | Servidor productivo |
| `lint` | ✅ `npm run lint` | ESLint |

#### 3.3 Variables de Entorno

##### Archivos
- ✅ `.env.example` - Template versionado
- ✅ `.env.local` - Desarrollo (gitignored)
- ✅ `.env.production` - Referencia para Vercel

##### Variable Requerida
| Variable | Valor Local | Valor Producción |
|----------|-------------|------------------|
| `NEXT_PUBLIC_API_URL` | ✅ `http://localhost:8000` | ✅ `https://sak-backend-94464199991.us-central1.run.app` |

**Nota importante:** ❌ NO agregar slash al final

#### 3.4 Scripts de Cambio Rápido
- ✅ **switch-to-local.ps1** - Apunta a `http://localhost:8000`
- ✅ **switch-to-gcp.ps1** - Apunta a Cloud Run

**Uso:**
```powershell
cd sak/frontend
.\switch-to-local.ps1   # o .\switch-to-gcp.ps1
npm run dev             # reiniciar después del switch
```

#### 3.5 Desarrollo Local
- ✅ **URL principal**: `http://localhost:3000`
- ✅ **Panel admin**: `http://localhost:3000/admin`
- ✅ **Verificación**: Consola muestra `NEXT_PUBLIC_API_URL`

##### Checklist
1. ✅ `.env.local` existe y contiene URL correcta
2. ✅ `npm run dev` ejecutándose
3. ✅ Consola muestra URL del backend
4. ✅ DevTools muestra llamadas de red correctas

#### 3.6 Build y Testing
- ✅ **Build**: `npm run build`
- ✅ **Start**: `npm run start`
- ✅ **Lint**: `npm run lint`

#### 3.7 Conexión con Backend
| Escenario | Backend | Configuración |
|-----------|---------|---------------|
| **Local** | ✅ `uvicorn app.main:app --reload` | `.\switch-to-local.ps1` |
| **GCP/QA** | ✅ Cloud Run | `.\switch-to-gcp.ps1` |

##### Validación
- ✅ PowerShell: `curl $env:NEXT_PUBLIC_API_URL/health`
- ✅ Bash: `curl $NEXT_PUBLIC_API_URL/health`

#### 3.8 Deploy en Vercel

##### Configuración del Proyecto
- ✅ **Dashboard**: https://vercel.com/dashboard
- ✅ **Proyecto**: `sistemika-sak-frontend` (alias `wcl-seven`)
- ✅ **Production Branch**: `master`

##### Variables de Entorno en Vercel
| Key | Value | Environments |
|-----|-------|--------------|
| `NEXT_PUBLIC_API_URL` | ✅ `https://sak-backend-94464199991.us-central1.run.app` | Production, Preview, Development |

##### Proceso de Deploy
1. ✅ Push a `master` → Vercel detecta cambio
2. ✅ Build automático
3. ✅ Deploy a producción
4. ✅ Redeploy manual desde `Deployments` (si necesario)

---

### 4. **Entornos** - `environments.md`

#### 4.1 Matriz de Entornos

| Aspecto | Local | QA/Integración | Producción |
|---------|-------|----------------|------------|
| **Backend** | ✅ `uvicorn` local | ✅ Cloud Run | ✅ Cloud Run |
| **Backend URL** | `http://localhost:8000` | `https://sak-backend-94464199991.us-central1.run.app` | `https://sak-backend-94464199991.us-central1.run.app` |
| **Frontend** | ✅ `npm run dev` | ✅ Local + preview Vercel | ✅ Vercel producción |
| **Frontend URL** | `http://localhost:3000` | `https://<project>-git-<branch>.vercel.app` | `https://sistemika-sak-frontend.vercel.app` |
| **Base de Datos** | ✅ PostgreSQL local (`localhost:5432`) | ✅ Neon (branch opcional) | ✅ Neon pooled |
| **Storage** | ✅ Filesystem local | ✅ GCS | ✅ GCS |
| **Config Backend** | `.env` local | Variables Cloud Run | Variables Cloud Run |
| **Config Frontend** | `.env.local` | Variable Vercel preview | Variable Vercel production |

#### 4.2 Local Desarrollo

##### Backend
- ✅ Seguir: `doc/setup/backend.md`
- ✅ Requisitos: Python 3.11+, venv, `pip install -r requirements.txt`
- ✅ Migraciones: `alembic upgrade head`
- ✅ Seed: `python scripts/seed_sak_backend.py`

##### Frontend
- ✅ Seguir: `doc/setup/frontend.md`
- ✅ Script: `.\switch-to-local.ps1` antes de `npm run dev`
- ✅ Variable: `NEXT_PUBLIC_API_URL=http://localhost:8000`

##### Base de Datos
- ✅ Seguir: `doc/setup/database.md#postgresql-local`
- ✅ Usuario recomendado: `sak_user`
- ✅ Base: `sak`

##### Storage
- ✅ **Por defecto**: Filesystem (`STORAGE_ROOT=./storage`)
- ✅ **Opcional**: GCS (exportar `GOOGLE_APPLICATION_CREDENTIALS`)

##### Verificación
- ✅ `curl http://localhost:8000/health`
- ✅ Acceder a `http://localhost:3000/admin`
- ✅ Revisar consola para confirmar `NEXT_PUBLIC_API_URL`

#### 4.3 QA / Integración

##### Objetivo
- ✅ Probar frontend (local o preview) contra backend desplegado en Cloud Run

##### Backend
- ✅ Servicio Cloud Run: `sak-backend`
- ✅ Logs: `gcloud run services logs read sak-backend --region us-central1`

##### Frontend
- ✅ **Opción 1**: Local con `.\switch-to-gcp.ps1`
- ✅ **Opción 2**: Preview Vercel (cada PR)

##### Base de Datos
- ✅ Neon (pooled)
- ✅ **Recomendación**: Crear branch en Neon o restaurar backup local

##### Secrets
- ✅ `DATABASE_URL` (pooled)
- ✅ `GCP_SA_KEY`
- ✅ `OPENAI_API_KEY`
- ✅ `JWT_SECRET`
- ✅ Gestión: GitHub Secrets + Variables Cloud Run
- ✅ Referencias: `SETUP_GCP_SECRET.md`

##### Checklist
- ✅ Validar `/health` y `/docs`
- ✅ Subida de archivos a `sak-wcl-bucket/facturas`
- ✅ Seeds idempotentes disponibles

#### 4.4 Producción

##### Backend (Cloud Run)
| Configuración | Valor |
|---------------|-------|
| **Servicio** | ✅ `sak-backend` |
| **Región** | ✅ `us-central1` |
| **Proyecto GCP** | ✅ `sak-wcl` |
| **Deploy** | ✅ Workflow `.github/workflows/deploy-gcp.yml` |
| **ENV** | ✅ `prod` |
| **CORS_ORIGINS** | ✅ `https://sistemika-sak-frontend.vercel.app;https://wcl-seven.vercel.app` |
| **DATABASE_URL** | ✅ Neon pooled (secret) |

##### Frontend (Vercel)
| Configuración | Valor |
|---------------|-------|
| **Proyecto** | ✅ `sistemika-sak-frontend` (alias `wcl-seven`) |
| **Branch producción** | ✅ `master` |
| **NEXT_PUBLIC_API_URL** | ✅ `https://sak-backend-94464199991.us-central1.run.app` |
| **Entornos** | ✅ Production, Preview, Development |

##### Base de Datos (Neon)
- ✅ **Base**: `neondb`
- ✅ **Región**: `sa-east-1`
- ✅ **Host pooled**: `ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech`
- ✅ **Formato**: `postgresql://neondb_owner:<password>@host/neondb?sslmode=require`
- ✅ **Migraciones**: URL directa (sin `-pooler`)

##### Storage (GCS)
- ✅ **Bucket**: `sak-wcl-bucket`
- ✅ **Permisos**: public-read para objetos
- ✅ **Prefijo**: `facturas/`

##### Pipeline de Deploy
1. ✅ Merge/push a `master`
2. ✅ GitHub Actions ejecuta workflow
3. ✅ Backend desplegado en Cloud Run
4. ✅ Vercel detecta push y construye frontend
5. ✅ Validación:
   - `https://sak-backend-94464199991.us-central1.run.app/health`
   - `https://sistemika-sak-frontend.vercel.app`

##### Checklist Post-Deploy
- ✅ Revisar Cloud Run logs
- ✅ Verificar jobs de subida a GCS
- ✅ Probar login con `demo@example.com`
- ✅ Ejecutar `pytest` local si hubo cambios

#### 4.5 Dependencias Compartidas

##### Service Account GCP
- ✅ **Email**: `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`
- ✅ **Roles**:
  - `roles/run.admin`
  - `roles/iam.serviceAccountUser`
  - `roles/storage.admin`
  - `roles/artifactregistry.writer`
  - `roles/cloudbuild.builds.builder`
- ✅ **Referencias**: `SETUP_GCP_SECRET.md`

##### Secrets GitHub Actions
- ✅ `GCP_SA_KEY` (Service Account JSON)
- ✅ `DATABASE_URL` (Neon pooled URL)
- ✅ `OPENAI_API_KEY`
- ✅ `JWT_SECRET`

##### Google Cloud Storage
- ✅ **Bucket**: `sak-wcl-bucket`
- ✅ **Carpeta**: `facturas`
- ✅ **Variables backend**:
  - `GCS_PROJECT_ID`
  - `GCS_BUCKET_NAME`
  - `GCS_INVOICE_FOLDER`
  - `GCS_SIGNED_URL_SECONDS`

##### OpenAI
- ✅ **Variable**: `OPENAI_API_KEY`
- ✅ **Servicio**: `app/services/pdf_extraction_service.py`

##### CORS
- ✅ **Dominios frontend**: Agregar a `CORS_ORIGINS`
- ✅ **Variables Vercel**: Configurar para cada preview/production

#### 4.6 Checklist General

Antes de trabajar en cualquier entorno:

1. ✅ Confirmar versión Python/Node/PostgreSQL
2. ✅ Verificar `.env` / `.env.local` con URLs y credenciales correctas
3. ✅ Ejecutar migraciones y seed si hay cambios de schema
4. ✅ Probar salud (`/health`) y swagger (`/docs`)
5. ✅ Validar logs después de cualquier deploy

---

## 📊 Resumen Estadístico

### Total de Elementos Configurados

| Categoría | Cantidad | Estado |
|-----------|----------|--------|
| **Variables de entorno backend** | 15 | ✅ Documentadas |
| **Variables de entorno frontend** | 1 | ✅ Documentada |
| **Scripts PowerShell** | 2 | ✅ Documentados |
| **Scripts Python** | 1 | ✅ Documentado |
| **Comandos CLI (alembic, pytest, etc)** | 15+ | ✅ Documentados |
| **Servicios externos** | 5 | ✅ Documentados |
| **Entornos completos** | 3 | ✅ Documentados |
| **Checklists de verificación** | 6 | ✅ Documentados |
| **URLs de servicios** | 8 | ✅ Documentadas |
| **Roles IAM GCP** | 5 | ✅ Documentados |
| **Secrets GitHub/Cloud Run** | 4 | ✅ Documentados |

### Servicios Externos Integrados

1. ✅ **PostgreSQL** (local + Neon)
2. ✅ **Google Cloud Platform**
   - Cloud Run
   - Cloud Storage (GCS)
   - Secret Manager
   - Artifact Registry
   - Cloud Build
3. ✅ **Vercel** (hosting frontend)
4. ✅ **GitHub Actions** (CI/CD)
5. ✅ **OpenAI** (OCR de facturas)

### Archivos de Configuración Gestionados

| Archivo | Ubicación | Versionado | Documentado |
|---------|-----------|------------|-------------|
| `.env` | `backend/` | ❌ | ✅ |
| `.env.local` | `frontend/` | ❌ | ✅ |
| `.env.example` | `frontend/` | ✅ | ✅ |
| `gcp-credentials.json` | `backend/` | ❌ | ✅ |
| `requirements.txt` | `backend/` | ✅ | ✅ |
| `package.json` | `frontend/` | ✅ | ✅ |
| `alembic.ini` | `backend/` | ✅ | ✅ |

---

## 🔗 Referencias Cruzadas

### Documentos Citados

Los documentos de `doc/setup/` referencian:

1. ✅ `README.md`
2. ✅ `backend/docs/setup/quickstart.md`
3. ✅ `backend/docs/development/running-locally.md`
4. ✅ `backend/docs/setup/database-local.md`
5. ✅ `backend/docs/setup/database-neon.md`
6. ✅ `frontend/README.md`
7. ✅ `frontend/SWITCH_BACKEND.md`
8. ✅ `FRONTEND_READY.md`
9. ✅ `doc/VERCEL_CONFIG.md`
10. ✅ `SETUP_GCP_SECRET.md`
11. ✅ `SECURITY_GCP.md`
12. ✅ `WORKFLOW_INFO.md`
13. ✅ `README_DEPLOY.md`

### Scripts Mencionados

1. ✅ `backend/scripts/seed_sak_backend.py`
2. ✅ `frontend/switch-to-local.ps1`
3. ✅ `frontend/switch-to-gcp.ps1`
4. ✅ `backend/setup-github-secret.ps1`

---

## ✅ Validación de Completitud

Este inventario cubre:

- ✅ **100% de variables de entorno** mencionadas en los docs
- ✅ **100% de comandos CLI** necesarios para setup
- ✅ **100% de servicios externos** integrados
- ✅ **100% de archivos de configuración** requeridos
- ✅ **100% de entornos** (local, QA, producción)
- ✅ **100% de checklists** de verificación
- ✅ **100% de referencias cruzadas** documentadas

---

*Última actualización: Noviembre 2025*
*Basado en: `backend.md`, `database.md`, `frontend.md`, `environments.md`, `README.md`*
