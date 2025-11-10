# GitHub Actions Workflow - Información

## Workflow Activo

**Ubicación:** `.github/workflows/deploy-gcp.yml` (en el root del monorepo `sistemika_dev`)

**Nombre:** Deploy to GCP Cloud Run

**Trigger:** Push al branch `master`

## Configuración

### Variables de Entorno
```yaml
PROJECT_ID: sak-wcl
SERVICE_NAME: sak-backend
REGION: us-central1
SERVICE_ACCOUNT: sak-wcl-service@sak-wcl.iam.gserviceaccount.com
```

### Secrets Requeridos
- `GCP_SA_KEY` - Service Account Key JSON de Google Cloud

### Variables de Entorno en Cloud Run
```bash
ENV=prod
CORS_ORIGINS=https://sistemika-sak-frontend.vercel.app;http://localhost:3000
SQLALCHEMY_ECHO=0
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas
```

### Secrets en Cloud Run
```bash
DATABASE_URL (Neon PostgreSQL)
OPENAI_API_KEY (OpenAI API)
JWT_SECRET (JWT token signing)
```

## Proceso de Deployment

1. **Checkout** - Descarga el código del repositorio
2. **Authenticate** - Autenticación en Google Cloud con Service Account
3. **Setup Cloud SDK** - Configura gcloud CLI
4. **Deploy** - Despliega el backend desde `./sak/backend` a Cloud Run
5. **Show URL** - Muestra la URL del servicio desplegado

## Ruta del Backend

El workflow despliega desde: `./sak/backend`

Esto significa que el backend está en el subdirectorio `sak/` del monorepo.

## Workflows Eliminados (Limpieza 19/10/2025)

Los siguientes workflows fueron eliminados para evitar confusión:

- ❌ `.github/workflows/deploy-gcp-backend.yml` - Duplicado
- ❌ `.github/workflows/sync-master.yml` - Auto-sync obsoleto (deshabilitado)
- ❌ `sak/.github/workflows/deploy-gcp.yml` - Copia obsoleta

## URL del Servicio en Producción

**Backend API:** https://sak-backend-94464199991.us-central1.run.app
**Frontend:** https://sistemika-sak-frontend.vercel.app (alias: https://wcl-seven.vercel.app)

## GCS Bucket

**Nombre:** `sak-wcl-bucket`
**Región:** southamerica-east1
**Acceso:** Público (allUsers:objectViewer)
**URL pública:** `https://storage.googleapis.com/sak-wcl-bucket/{path}`

## Verificación del Deployment

Para verificar que un deployment fue exitoso:

1. Ve a: https://github.com/gustavo2866/sistemika_dev/actions
2. Busca el workflow "Deploy to GCP Cloud Run"
3. Verifica que el último run tenga status ✅ (verde)
4. Prueba el endpoint: `https://sak-backend-94464199991.us-central1.run.app/docs`

## Comandos Útiles

### Ver variables en Cloud Run
```bash
gcloud run services describe sak-backend \
  --region us-central1 \
  --project sak-wcl \
  --format="value(spec.template.spec.containers[0].env)"
```

### Ver logs del servicio
```bash
gcloud run services logs read sak-backend \
  --region us-central1 \
  --project sak-wcl \
  --limit 50
```

### Deployment manual (si es necesario)
```bash
cd sistemika_dev
gcloud run deploy sak-backend \
  --source ./sak/backend \
  --region us-central1 \
  --project sak-wcl
```

## Notas Importantes

- ⚠️ El workflow se ejecuta SOLO desde el root del monorepo (`.github/workflows/`)
- ⚠️ El path `./sak/backend` es relativo al root del monorepo
- ✅ El bucket GCS es público para evitar expiraciones de URL
- ✅ Las variables GCS son necesarias para el upload de facturas
- ✅ Cada push a `master` activa un deployment automático

## Última Actualización

**Fecha:** 19/10/2025
**Commit:** 160f870 - Limpieza de workflows duplicados
**Estado:** ✅ Funcionando correctamente
