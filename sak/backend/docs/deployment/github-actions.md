# 🚀 GitHub Actions - Deploy Automático

Workflow de deployment automático a Google Cloud Run.

---

## Resumen

Cada vez que haces **push a master**, GitHub Actions:

1. ✅ Descarga el código
2. ✅ Se autentica en Google Cloud
3. ✅ Despliega el backend a Cloud Run
4. ✅ Muestra la URL del servicio

**Tiempo total:** ~3-5 minutos

---

## Workflow Activo

**Archivo:** `.github/workflows/deploy-gcp.yml`

**Ubicación:** Root del monorepo `sistemika_dev/`

### Configuración

```yaml
name: Deploy to GCP Cloud Run

on:
  push:
    branches:
      - master

env:
  PROJECT_ID: sak-wcl
  SERVICE_NAME: sak-backend
  REGION: us-central1
  SERVICE_ACCOUNT: sak-wcl-service@sak-wcl.iam.gserviceaccount.com
```

---

## Cómo Activar un Deploy

### 1. Hacer Cambios en el Código

```bash
# Editar archivos
# ...

# Ver cambios
git status
git diff
```

### 2. Commit y Push

```bash
# Agregar cambios
git add .

# Commit
git commit -m "feat: descripción del cambio"

# Push a master (ESTO ACTIVA EL DEPLOY)
git push origin master
```

### 3. Monitorear el Deploy

**URL:** https://github.com/gustavo2866/sistemika_dev/actions

Verás el workflow "Deploy to GCP Cloud Run" ejecutándose.

---

## Pasos del Workflow

### 1. Checkout Repository

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```

Descarga el código del repositorio.

### 2. Authenticate to Google Cloud

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

Usa el secret `GCP_SA_KEY` para autenticarse.

### 3. Setup Cloud SDK

```yaml
- name: Set up Cloud SDK
  uses: google-github-actions/setup-gcloud@v2
  with:
    project_id: sak-wcl
```

Configura `gcloud` CLI.

### 4. Deploy to Cloud Run

```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy sak-backend \
      --source ./sak/backend \
      --region us-central1 \
      --project sak-wcl \
      --service-account sak-wcl-service@sak-wcl.iam.gserviceaccount.com \
      --allow-unauthenticated \
      --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
      --set-env-vars="ENV=prod,CORS_ORIGINS=https://sistemika-sak-frontend.vercel.app;http://localhost:3000,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=sak-wcl,GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
```

**Características:**
- Despliega desde `./sak/backend`
- Región: `us-central1`
- Service Account: `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`
- Público (`--allow-unauthenticated`)
- Secrets desde Secret Manager
- Variables de entorno configuradas

### 5. Show Service URL

```yaml
- name: Show service URL
  run: |
    echo "🚀 Deploy completado!"
    gcloud run services describe sak-backend \
      --region us-central1 \
      --format 'value(status.url)'
```

Muestra la URL final del servicio.

---

## Secrets Necesarios

Configurados en GitHub: **Settings → Secrets and variables → Actions**

### GCP_SA_KEY

Service Account Key en formato JSON.

**Contiene:**
```json
{
  "type": "service_account",
  "project_id": "sak-wcl",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "sak-wcl-service@sak-wcl.iam.gserviceaccount.com",
  ...
}
```

**Permisos necesarios:**
- Cloud Run Admin
- Service Account User
- Secret Manager Secret Accessor

---

## Secrets en GCP Secret Manager

Los siguientes secrets deben existir en GCP Secret Manager:

### DATABASE_URL

```
postgresql://neondb_owner:***@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

### OPENAI_API_KEY

```
sk-proj-***
```

### JWT_SECRET

```
tu_secret_super_secreto_para_jwt
```

---

## Variables de Entorno en Cloud Run

Configuradas automáticamente por el workflow:

```bash
ENV=prod
CORS_ORIGINS=https://sistemika-sak-frontend.vercel.app;http://localhost:3000
SQLALCHEMY_ECHO=0
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas
```

---

## Verificar Deployment Exitoso

### 1. Ver Logs del Workflow

```
GitHub → Actions → "Deploy to GCP Cloud Run" → Ver run más reciente
```

Debe terminar con ✅ verde.

### 2. Health Check

```bash
curl https://sak-backend-94464199991.us-central1.run.app/health
```

Debe responder: `{"status":"healthy"}`

### 3. API Docs

Abrir: https://sak-backend-94464199991.us-central1.run.app/docs

### 4. Ver Logs en Cloud Run

```bash
gcloud run services logs read sak-backend --region us-central1 --limit 50
```

---

## Troubleshooting

### Deploy Falla con "Permission Denied"

**Causa:** Service Account no tiene permisos.

**Solución:**
```bash
gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

### Deploy Falla con "Secret not found"

**Causa:** Secret no existe en Secret Manager.

**Solución:**
```bash
# Crear secret
echo -n "valor_del_secret" | gcloud secrets create NOMBRE_SECRET \
  --data-file=- \
  --project=sak-wcl

# Dar permisos al Service Account
gcloud secrets add-iam-policy-binding NOMBRE_SECRET \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=sak-wcl
```

### Build Tarda Mucho

**Causa:** Buildpacks instala todas las dependencias cada vez.

**Solución:** Normal en Cloud Run. Tiempo esperado: 2-4 minutos.

### Deployment Exitoso pero 500 Error

**Causa:** Error en la aplicación o configuración incorrecta.

**Solución:**
```bash
# Ver logs
gcloud run services logs read sak-backend --region us-central1 --limit 50

# Verificar variables de entorno
gcloud run services describe sak-backend --region us-central1 --format="value(spec.template.spec.containers[0].env)"
```

---

## Deploy Manual (Sin GitHub Actions)

Si necesitas hacer deploy sin pasar por GitHub Actions:

```bash
# Autenticarse
gcloud auth login

# Deploy
cd sistemika_dev
gcloud run deploy sak-backend \
  --source ./sak/backend \
  --region us-central1 \
  --project sak-wcl \
  --allow-unauthenticated
```

---

## Workflows Eliminados

Los siguientes workflows fueron eliminados en la limpieza del 19/10/2025:

- ❌ `deploy-gcp-backend.yml` - Duplicado
- ❌ `sync-master.yml` - Auto-sync obsoleto
- ❌ `sak/.github/workflows/deploy-gcp.yml` - Copia en subdirectorio

**Ahora solo existe:** `.github/workflows/deploy-gcp.yml` (en root)

---

## 📚 Ver También

- [Secrets Management](secrets-management.md)
- [Variables de producción](environment-prod.md)
- [Troubleshooting deployment](troubleshooting.md)
- [Google Cloud Run](gcp-cloud-run.md)
