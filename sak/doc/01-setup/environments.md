# Setup de entornos

Resumen de configuraciones comprobado contra `WORKFLOW_INFO.md`, `FRONTEND_READY.md`, `doc/VERCEL_CONFIG.md`, `SETUP_GCP_SECRET.md`, `README_DEPLOY.md` y `backend/docs/README.md`.

## Matriz rapida

| Entorno | Backend | Frontend | Base de datos | Notas |
| ------- | ------- | -------- | ------------- | ----- |
| Local desarrollo | `uvicorn app.main:app --reload` en `backend/` | `npm run dev` en `frontend/` | PostgreSQL local (`sak` en `localhost:5432`) | Usar `.env` local, `switch-to-local.ps1`, storage local o GCS opcional. |
| QA / Integracion (branch `gcp`) | Cloud Run `sak-backend` (`https://sak-backend-94464199991.us-central1.run.app`) | Frontend local o Vercel preview | Neon branch principal (`ep-steep-bird-acyo7x0e`) | GitHub Actions despliega al hacer push a `gcp` y luego merge/manual a `master`. |
| Produccion | Cloud Run `sak-backend` (`us-central1`) | Vercel (`sistemika-sak-frontend.vercel.app` y alias `wcl-seven.vercel.app`) | Neon `neondb` (pooled URL con `sslmode=require`) | Workflow `Deploy to GCP Cloud Run` se activa con push a `master`. Vercel usa branch `master`. |

## Local desarrollo

- **Backend:** seguir `doc/setup/backend.md`. Requiere Python 3.11+, venv activo, `pip install -r backend/requirements.txt`, `alembic upgrade head`.
- **Frontend:** ver `doc/setup/frontend.md`. Ejecutar `.\switch-to-local.ps1` antes de `npm run dev` para escribir `NEXT_PUBLIC_API_URL=http://localhost:8000` en `.env.local`.
- **Base de datos:** usar `doc/setup/database.md#postgresql-local`. Usuario recomendado `sak_user`, base `sak`.
- **Storage:** por defecto se usa el filesystem local (`STORAGE_ROOT=./storage`). GCS es opcional en local; si se usa, exportar `GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json`.
- **Verificacion:** `curl http://localhost:8000/health`, ingresar a `http://localhost:3000/admin`, revisar consola para confirmar `NEXT_PUBLIC_API_URL`.

## QA / Integracion

- **Objetivo:** probar el frontend local o preview contra el backend desplegado en Cloud Run antes de liberar a produccion.
- **Backend:** reutiliza la instancia de Cloud Run `sak-backend` (mismo servicio que prod). Control via `gcloud run services logs read sak-backend --region us-central1`.
- **Frontend:** dos opciones:
  - Local apuntando a Cloud Run (`.\switch-to-gcp.ps1` escribe `NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app`).
  - Preview en Vercel (cada PR crea `https://<project>-git-<branch>.vercel.app`).
- **Base de datos:** Neon (pooled). Para tareas de QA se recomienda crear un branch en Neon o restaurar backup local (`pg_dump`/`psql`) segun `doc/setup/database.md`.
- **Secrets requeridos:** `DATABASE_URL` (pooled), `GCP_SA_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`. Se gestionan via GitHub Secrets y Variables de Cloud Run; revisar `SETUP_GCP_SECRET.md`.
- **Checklist:** despues de cada deploy QA, validar `/health`, `/docs`, subida de archivos a `sak-wcl-bucket/facturas` y seeds idempotentes (`python scripts/seed_sak_backend.py` si hace falta datos demo).

## Produccion

- **Backend (Cloud Run):**
  - Servicio: `sak-backend`
  - Region: `us-central1`
  - Projecto GCP: `sak-wcl`
  - Despliegue: workflow `.github/workflows/deploy-gcp.yml` (ver `WORKFLOW_INFO.md`)
  - Variables Cloud Run principales: `ENV=prod`, `CORS_ORIGINS=https://sistemika-sak-frontend.vercel.app;https://wcl-seven.vercel.app`, `GCS_*`, `DATABASE_URL` (Neon).

- **Frontend (Vercel):**
  - Proyecto: `sistemika-sak-frontend` (alias `wcl-seven`)
  - Branch de produccion: `master`
  - Variable obligatoria: `NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app` (configurada para Production/Preview/Development segun `doc/VERCEL_CONFIG.md`).

- **Base de datos:** Neon `neondb` en `sa-east-1`, pooled host `ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech`. Usar formato `postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`. Para migraciones usar la URL directa (sin `-pooler`).

- **Storage:** bucket GCS `sak-wcl-bucket` (public-read para objetos). Prefijo usado por el backend: `facturas/`.

- **Pipeline:**
  1. Merge/push a `master`.
  2. GitHub Actions ejecuta `Deploy to GCP Cloud Run` y publica el backend.
  3. Vercel detecta el push y construye el frontend.
  4. Validar `https://sak-backend-94464199991.us-central1.run.app/health` y `https://sistemika-sak-frontend.vercel.app`.

- **Checklist post deploy:** revisar Cloud Run logs, verificar jobs de subida a GCS, probar login con usuario demo (`demo@example.com`), ejecutar `pytest` local si hubo cambios en backend.

## Dependencias compartidas

- **Service account GCP:** `sak-wcl-service@sak-wcl.iam.gserviceaccount.com` con roles `run.admin`, `iam.serviceAccountUser`, `storage.admin`, `artifactregistry.writer` (ver `SETUP_GCP_SECRET.md`).
- **Secretos GitHub Actions:** `GCP_SA_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET`.
- **Bucket GCS:** `sak-wcl-bucket`, carpeta `facturas`. El backend usa `GCS_PROJECT_ID`, `GCS_BUCKET_NAME`, `GCS_INVOICE_FOLDER` y `GCS_SIGNED_URL_SECONDS`.
- **OpenAI:** clave en `.env` (`OPENAI_API_KEY`) usada por `app/services/pdf_extraction_service.py`.
- **Dominios frontend aceptados:** agregar cada dominio/preview a `CORS_ORIGINS` y a las variables de Vercel cuando sea necesario.

## Checklist general antes de trabajar en un entorno

1. Confirmar version de Python/Node/PostgreSQL requerida.
2. Verificar que `.env` o `.env.local` tienen URLs y credenciales correctas.
3. Ejecutar migraciones y seed si hubo cambios de schema.
4. Probar salud (`/health`) y swagger (`/docs`).
5. Validar logs (Uvicorn local, Cloud Run, Vercel) despues de cualquier deploy.

> Si algun paso no coincide con estas notas, revisar las fuentes originales mencionadas arriba para asegurarse de que no hubo cambios recientes fuera de este resumen.
