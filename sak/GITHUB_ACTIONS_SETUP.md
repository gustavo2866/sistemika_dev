# Configuración GitHub Actions - Deploy a GCP Cloud Run

## 📋 Resumen

Este workflow despliega automáticamente tu backend a GCP Cloud Run cuando haces push a `master`.

## 🔑 Configurar Secreto en GitHub

Necesitas agregar la clave de la cuenta de servicio de GCP como secreto en GitHub.

### Opción 1: Usar el script automático

```powershell
cd backend
.\setup-github-secret.ps1
```

### Opción 2: Configurar manualmente

#### Paso 1: Obtener la clave de la cuenta de servicio

```bash
# En GCP Cloud Shell o con gcloud configurado:
gcloud iam service-accounts keys create gcp-key.json \
  --iam-account=sak-wcl-service@sak-wcl.iam.gserviceaccount.com \
  --project=sak-wcl
```

#### Paso 2: Agregar el secreto a GitHub

1. Ve a tu repositorio en GitHub
2. Ve a **Settings** → **Secrets and variables** → **Actions**
3. Click en **New repository secret**
4. Nombre: `GCP_SA_KEY`
5. Valor: Pega todo el contenido del archivo `gcp-key.json`
6. Click en **Add secret**

#### Paso 3: Verificar permisos de la cuenta de servicio

La cuenta de servicio debe tener estos roles:

```bash
gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

## 🚀 Cómo funciona

### Flujo automático:

```
Push a master → GitHub Action se activa → 
Autentica con GCP → Despliega a Cloud Run → 
Tu app está actualizada en producción
```

### Triggers:

- **Cuándo**: Cada push a `master`
- **Qué**: Despliega `./backend` a Cloud Run
- **Dónde**: `sak-backend` en región `us-central1`

## 📊 Ver el estado del deploy

1. Ve a tu repositorio en GitHub
2. Click en la pestaña **Actions**
3. Verás el workflow "Deploy to GCP Cloud Run"
4. Click en cualquier ejecución para ver los logs

## 🔧 Configuración del Workflow

El archivo está en: `.github/workflows/deploy-gcp.yml`

### Variables de entorno configuradas:

- `PROJECT_ID`: sak-wcl
- `SERVICE_NAME`: sak-backend
- `REGION`: us-central1
- `SERVICE_ACCOUNT`: sak-wcl-service@sak-wcl.iam.gserviceaccount.com

### Secretos configurados en Cloud Run:

- `DATABASE_URL`: URL de tu base de datos Neon
- `OPENAI_API_KEY`: Tu API key de OpenAI
- `JWT_SECRET`: Secret para tokens JWT

### Variables de entorno configuradas:

- `ENV`: prod
- `CORS_ORIGINS`: https://wcl-seven.vercel.app;http://localhost:3000
- `SQLALCHEMY_ECHO`: 0

## 🔄 Workflows Actuales

Ahora tienes 2 workflows:

1. **sync-master.yml**: Push a `gcp` → Sincroniza a `master`
2. **deploy-gcp.yml**: Push a `master` → Despliega a Cloud Run

### Flujo completo:

```
1. Trabajas en branch gcp
2. git push origin gcp
3. Action sincroniza gcp → master
4. Action despliega master → Cloud Run
5. ✅ Tu app está en producción
```

## ⚠️ Notas Importantes

1. **No elimines** el archivo `gcp-key.json` después de subirlo como secreto (puedes guardarlo de forma segura)
2. **Verifica** que los secretos en GCP Secret Manager estén actualizados
3. **Revisa** los logs en GitHub Actions si algo falla
4. **Primera ejecución** puede tardar unos minutos

## 🐛 Troubleshooting

### Error: "Permission denied"
- Verifica que el secreto `GCP_SA_KEY` esté configurado
- Verifica los roles de la cuenta de servicio

### Error: "Secret not found"
- Verifica que los secretos existan en GCP Secret Manager:
  ```bash
  gcloud secrets list --project=sak-wcl
  ```

### Error: "Region not found"
- Verifica que la región `us-central1` esté habilitada en tu proyecto

## 📚 Referencias

- [GitHub Actions](https://docs.github.com/en/actions)
- [Google Cloud Run](https://cloud.google.com/run/docs)
- [GCP Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs)
