# 🚀 GitHub Actions - Flujo de Deploy Automático

## 📋 Resumen

Este documento describe el flujo de trabajo automatizado para desplegar el backend a GCP Cloud Run usando GitHub Actions.

## 🔄 Workflow Activo

### `deploy-gcp.yml` - Deploy Automático a Cloud Run

**Ubicación:** `.github/workflows/deploy-gcp.yml`

**Trigger:** Push a branch `master`

**Acción:** Despliega automáticamente el backend a GCP Cloud Run

---

## 🎯 Flujo de Trabajo

### Opción 1: Merge manual desde `gcp` a `master`

```bash
# 1. Trabajas en branch gcp
git checkout gcp

# 2. Haces tus cambios
# ... editas archivos ...

# 3. Commit y push a gcp
git add .
git commit -m "feat: nueva funcionalidad"
git push origin gcp

# 4. Cuando estés listo para producción, haces merge a master
git checkout master
git merge gcp
git push origin master  # ← Esto dispara el deploy automático a GCP

# 5. Vuelves a gcp para seguir trabajando
git checkout gcp
```

### Opción 2: Push directo a `master`

```bash
# 1. Trabajas directamente en master (no recomendado para desarrollo)
git checkout master

# 2. Haces cambios y commit
git add .
git commit -m "fix: corrección urgente"
git push origin master  # ← Dispara deploy automático
```

---

## 🤖 ¿Qué hace el workflow?

Cuando haces push a `master`, el workflow ejecuta estos pasos:

### 1. **Checkout del código**
   - Descarga el código del repositorio

### 2. **Autenticación en GCP**
   - Usa el secreto `GCP_SA_KEY` para autenticarse
   - Configurado en: GitHub → Settings → Secrets → Actions

### 3. **Configuración de Cloud SDK**
   - Configura `gcloud` CLI con el proyecto `sak-wcl`

### 4. **Deploy a Cloud Run**
   - Despliega el contenido de `./backend` a Cloud Run
   - Servicio: `sak-backend`
   - Región: `us-central1`
   - Cuenta de servicio: `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`

### 5. **Configuración del servicio**
   - **Secretos** (desde GCP Secret Manager):
     - `DATABASE_URL` → Conexión a Neon PostgreSQL
     - `OPENAI_API_KEY` → API key de OpenAI
     - `JWT_SECRET` → Secret para JWT
   
   - **Variables de entorno**:
     - `ENV=prod`
     - `CORS_ORIGINS=https://wcl-seven.vercel.app;http://localhost:3000`
     - `SQLALCHEMY_ECHO=0`
   
   - **Acceso**: `--allow-unauthenticated` (API pública)

### 6. **Resultado**
   - Muestra la URL del servicio desplegado
   - Servicio disponible en: Cloud Run URL

---

## 📊 Monitorear el Deploy

### Ver logs del workflow:

1. Ve a: https://github.com/gustavo2866/sistemika_dev/actions

2. Verás las ejecuciones del workflow "Deploy to GCP Cloud Run"

3. Click en cualquier ejecución para ver:
   - ✅ Estado (Success, Failed, In Progress)
   - 📋 Logs detallados de cada paso
   - ⏱️ Tiempo de ejecución
   - 🔗 URL del servicio desplegado

### Ver logs en GCP Cloud Run:

```bash
# Ver logs en tiempo real
gcloud run services logs read sak-backend \
  --region us-central1 \
  --project sak-wcl \
  --limit 50

# Ver logs con tail (seguimiento continuo)
gcloud run services logs tail sak-backend \
  --region us-central1 \
  --project sak-wcl
```

### Ver detalles del servicio:

```bash
# Información del servicio
gcloud run services describe sak-backend \
  --region us-central1 \
  --project sak-wcl

# URL del servicio
gcloud run services describe sak-backend \
  --region us-central1 \
  --format 'value(status.url)'
```

---

## ⚠️ Troubleshooting

### Error: "Permission denied"

**Causa:** El secreto `GCP_SA_KEY` no está configurado o es inválido

**Solución:**
```powershell
cd backend
.\setup-github-secret-clean.ps1
```

### Error: "Secret not found"

**Causa:** Los secretos no existen en GCP Secret Manager

**Verificar:**
```bash
gcloud secrets list --project=sak-wcl
```

**Crear secretos faltantes:**
```bash
# DATABASE_URL
echo -n "tu-database-url" | gcloud secrets create DATABASE_URL \
  --data-file=- \
  --project=sak-wcl

# OPENAI_API_KEY
echo -n "tu-openai-key" | gcloud secrets create OPENAI_API_KEY \
  --data-file=- \
  --project=sak-wcl

# JWT_SECRET
echo -n "tu-jwt-secret" | gcloud secrets create JWT_SECRET \
  --data-file=- \
  --project=sak-wcl
```

### Error: "Build failed"

**Causa:** Errores en el código o dependencias

**Solución:**
1. Revisa los logs en GitHub Actions
2. Verifica que `requirements.txt` esté actualizado
3. Prueba el build localmente:
   ```bash
   docker build -t test-build ./backend
   ```

### Error: "Service account not found"

**Causa:** La cuenta de servicio no tiene los permisos necesarios

**Solución:**
```bash
# Verificar roles
gcloud projects get-iam-policy sak-wcl \
  --flatten="bindings[].members" \
  --format='table(bindings.role)' \
  --filter="bindings.members:sak-wcl-service@sak-wcl.iam.gserviceaccount.com"

# Agregar roles necesarios
gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

---

## 🔒 Seguridad

### Secretos en GitHub

- **`GCP_SA_KEY`**: Clave JSON de la cuenta de servicio
  - ✅ Almacenado de forma segura en GitHub Secrets
  - ❌ No se muestra en logs
  - ❌ No se puede leer después de agregarlo

### Secretos en GCP

Los valores sensibles se almacenan en GCP Secret Manager:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `JWT_SECRET`

**Ventajas:**
- ✅ No están en el código
- ✅ Versionados y auditables
- ✅ Acceso controlado por IAM
- ✅ Rotación fácil sin redesplegar

### Archivo gcp-credentials.json

- ✅ Está en `.gitignore`
- ✅ Está en `.gcloudignore`
- ✅ NUNCA se sube al repositorio
- ✅ Solo existe localmente para desarrollo

---

## 🔧 Configuración del Workflow

### Variables de entorno (configurables en el workflow):

```yaml
env:
  PROJECT_ID: sak-wcl
  SERVICE_NAME: sak-backend
  REGION: us-central1
  SERVICE_ACCOUNT: sak-wcl-service@sak-wcl.iam.gserviceaccount.com
```

### Modificar configuración:

Edita el archivo: `.github/workflows/deploy-gcp.yml`

**Cambiar región:**
```yaml
REGION: us-east1  # Cambiar a otra región
```

**Cambiar nombre del servicio:**
```yaml
SERVICE_NAME: mi-nuevo-backend
```

**Agregar más secretos:**
```yaml
--set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,NEW_SECRET=NEW_SECRET:latest"
```

**Agregar más variables de entorno:**
```yaml
--set-env-vars="ENV=prod,CORS_ORIGINS=https://wcl-seven.vercel.app,NEW_VAR=value"
```

---

## 📈 Mejores Prácticas

### 1. **Branches**
   - `gcp`: Desarrollo continuo
   - `master`: Producción estable
   - Merge a `master` solo cuando esté listo para producción

### 2. **Commits**
   - Usa mensajes descriptivos
   - Sigue convenciones: `feat:`, `fix:`, `docs:`, `chore:`
   
### 3. **Testing**
   - Prueba localmente antes de hacer push a `master`
   - Verifica logs de GitHub Actions después del deploy

### 4. **Rollback**
   - Si algo sale mal, puedes hacer rollback en Cloud Run:
   ```bash
   gcloud run services update-traffic sak-backend \
     --to-revisions=PREVIOUS_REVISION=100 \
     --region us-central1 \
     --project sak-wcl
   ```

### 5. **Monitoreo**
   - Revisa logs después de cada deploy
   - Configura alertas en GCP Cloud Monitoring
   - Verifica endpoints críticos después del deploy

---

## 📚 Referencias

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GCP Cloud Run Docs](https://cloud.google.com/run/docs)
- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Service Accounts Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)

---

## 📞 Soporte

### Ver estado actual:

```bash
# Cloud Run
gcloud run services describe sak-backend \
  --region us-central1 \
  --project sak-wcl

# GitHub Actions
# https://github.com/gustavo2866/sistemika_dev/actions
```

### Comandos útiles:

```bash
# Ver últimas revisiones
gcloud run revisions list \
  --service sak-backend \
  --region us-central1 \
  --project sak-wcl

# Ver tráfico
gcloud run services describe sak-backend \
  --region us-central1 \
  --format 'get(status.traffic)'

# Ver variables de entorno
gcloud run services describe sak-backend \
  --region us-central1 \
  --format 'yaml(spec.template.spec.containers[0].env)'
```

---

**Última actualización:** Octubre 2025  
**Workflow activo:** `deploy-gcp.yml`  
**Proyecto GCP:** `sak-wcl`  
**Servicio:** `sak-backend`
