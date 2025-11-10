# 🚀 GitHub Actions - Documentación Completa

## 📋 Índice

- [Visión General](#visión-general)
- [Ubicación de Archivos](#ubicación-de-archivos)
- [Workflows Configurados](#workflows-configurados)
- [Configuración Detallada](#configuración-detallada)
- [Secrets y Variables](#secrets-y-variables)
- [Proceso de Deployment](#proceso-de-deployment)
- [Troubleshooting](#troubleshooting)
- [Monitoreo y Logs](#monitoreo-y-logs)

---

## 🎯 Visión General

GitHub Actions automatiza el deployment del backend SAK a Google Cloud Platform (GCP) Cloud Run cada vez que se hace push al branch `master`.

**Flujo automático:**
```
Push a master → GitHub Actions → Build & Deploy → Cloud Run → URL productiva
```

---

## 📁 Ubicación de Archivos

### Estructura del Repositorio

```
sistemika/                                    ← Root del repositorio GitHub
├── .github/
│   └── workflows/
│       └── deploy-gcp.yml                   ← ⭐ Workflow principal
└── sak/                                      ← Monorepo del proyecto
    ├── backend/                              ← Código fuente del backend
    │   ├── app/
    │   ├── requirements.txt
    │   ├── Procfile
    │   └── ...
    └── frontend/                             ← Código fuente del frontend
        └── ...
```

### Archivo Principal

**Path:** `c:\Users\gpalmieri\source\sistemika\.github\workflows\deploy-gcp.yml`

**Git Path:** `.github/workflows/deploy-gcp.yml` (desde el root del repo)

**Nota importante:** El archivo está en el **directorio padre** `sistemika`, no dentro de `sak/`.

---

## ⚙️ Workflows Configurados

### 1. Deploy to GCP Cloud Run

**Archivo:** `deploy-gcp.yml`

**Trigger:**
```yaml
on:
  push:
    branches:
      - master
```

**Se ejecuta cuando:**
- Haces `git push origin master`
- Haces merge de un PR a `master`
- Haces un commit directo a `master`

**NO se ejecuta cuando:**
- Trabajas en otros branches
- Haces cambios locales sin push
- Editas archivos en GitHub sin commit

---

## 🔧 Configuración Detallada

### Variables de Entorno Globales

```yaml
env:
  PROJECT_ID: sak-wcl                          # Proyecto GCP
  SERVICE_NAME: sak-backend                    # Nombre del servicio Cloud Run
  REGION: us-central1                          # Región de deployment
  SERVICE_ACCOUNT: sak-wcl-service@sak-wcl.iam.gserviceaccount.com
```

### Jobs y Steps

#### Job: deploy

**Runner:** `ubuntu-latest` (máquina virtual Linux en GitHub)

**Steps:**

##### 1️⃣ Checkout del Código
```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```
- Descarga el código del repositorio
- Incluye todo el historial de commits
- Usa la versión más reciente del action

##### 2️⃣ Autenticación en GCP
```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```
- Autentica usando Service Account
- Usa el secret `GCP_SA_KEY` (JSON key)
- Necesario para acceder a recursos de GCP

##### 3️⃣ Setup Cloud SDK
```yaml
- name: Set up Cloud SDK
  uses: google-github-actions/setup-gcloud@v2
  with:
    project_id: ${{ env.PROJECT_ID }}
```
- Instala y configura `gcloud` CLI
- Establece el proyecto por defecto
- Permite ejecutar comandos `gcloud`

##### 4️⃣ Deploy a Cloud Run
```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy ${{ env.SERVICE_NAME }} \
      --source ./sak/backend \
      --region ${{ env.REGION }} \
      --project ${{ env.PROJECT_ID }} \
      --service-account ${{ env.SERVICE_ACCOUNT }} \
      --allow-unauthenticated \
      --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
      --set-env-vars="ENV=prod,CORS_ORIGINS=https://sistemika-sak-frontend.vercel.app;http://localhost:3000,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=${{ env.PROJECT_ID }},GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
```

**Parámetros importantes:**

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `--source` | `./sak/backend` | Directorio con el código a desplegar |
| `--region` | `us-central1` | Región de GCP donde se despliega |
| `--allow-unauthenticated` | - | Permite acceso público sin autenticación |
| `--set-secrets` | Ver abajo | Inyecta secrets desde Secret Manager |
| `--set-env-vars` | Ver abajo | Define variables de entorno |

##### 5️⃣ Mostrar URL
```yaml
- name: Show service URL
  run: |
    echo "🚀 Deploy completado!"
    gcloud run services describe ${{ env.SERVICE_NAME }} \
      --region ${{ env.REGION }} \
      --format 'value(status.url)'
```
- Imprime la URL del servicio desplegado
- Útil para verificar deployment exitoso

---

## 🔐 Secrets y Variables

### Secrets en GitHub (Repository Settings)

**Ubicación:** `Settings → Secrets and variables → Actions → Repository secrets`

#### Secret Requerido:

**`GCP_SA_KEY`**
- **Tipo:** JSON
- **Contenido:** Service Account Key de Google Cloud
- **Formato:**
  ```json
  {
    "type": "service_account",
    "project_id": "sak-wcl",
    "private_key_id": "...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "sak-wcl-service@sak-wcl.iam.gserviceaccount.com",
    "client_id": "...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    ...
  }
  ```
- **Cómo obtenerlo:**
  1. Ir a GCP Console → IAM & Admin → Service Accounts
  2. Seleccionar `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`
  3. Keys → Add Key → Create new key → JSON
  4. Copiar todo el contenido del archivo JSON

### Secrets en GCP Secret Manager

Estos secrets se inyectan en Cloud Run durante el deployment:

#### `DATABASE_URL`
- **Descripción:** URL de conexión a Neon PostgreSQL
- **Formato:** `postgresql://user:password@host/database?sslmode=require`
- **Ejemplo:** `postgresql://sak_user:xxx@ep-steep-bird-acyo7x0e-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`

#### `OPENAI_API_KEY`
- **Descripción:** API Key de OpenAI para OCR de facturas
- **Formato:** `sk-proj-...`

#### `JWT_SECRET`
- **Descripción:** Clave secreta para firmar tokens JWT
- **Formato:** String aleatorio largo
- **Ejemplo:** `tu_clave_secreta_muy_segura_y_larga_12345`

**Cómo gestionarlos:**
```bash
# Ver secrets existentes
gcloud secrets list --project=sak-wcl

# Ver versiones de un secret
gcloud secrets versions list DATABASE_URL --project=sak-wcl

# Crear nuevo secret
echo "valor_secreto" | gcloud secrets create NOMBRE_SECRET --data-file=- --project=sak-wcl

# Actualizar secret
echo "nuevo_valor" | gcloud secrets versions add NOMBRE_SECRET --data-file=- --project=sak-wcl
```

### Variables de Entorno en Cloud Run

Estas se configuran en el deployment:

```bash
ENV=prod                           # Entorno de ejecución
CORS_ORIGINS=https://sistemika-sak-frontend.vercel.app;http://localhost:3000
SQLALCHEMY_ECHO=0                  # No mostrar queries SQL en logs
GCS_PROJECT_ID=sak-wcl            # Proyecto para Google Cloud Storage
GCS_BUCKET_NAME=sak-wcl-bucket    # Bucket para almacenar facturas
GCS_INVOICE_FOLDER=facturas        # Carpeta dentro del bucket
```

---

## 🔄 Proceso de Deployment

### Flujo Completo

```mermaid
graph TD
    A[Developer hace git push a master] --> B[GitHub detecta push]
    B --> C[GitHub Actions inicia workflow]
    C --> D[Checkout código]
    D --> E[Autenticación GCP]
    E --> F[Setup gcloud CLI]
    F --> G[Build imagen Docker]
    G --> H[Push a GCP Artifact Registry]
    H --> I[Deploy a Cloud Run]
    I --> J[Configurar secrets y env vars]
    J --> K[Health check]
    K --> L{¿Exitoso?}
    L -->|Sí| M[Servicio activo]
    L -->|No| N[Rollback automático]
    M --> O[Notificación de éxito]
    N --> P[Notificación de error]
```

### Paso a Paso

#### 1. Pre-deployment
- Developer hace cambios locales
- Commit: `git commit -m "descripción"`
- Push: `git push origin master`

#### 2. GitHub Actions se activa
- Detecta push a `master`
- Crea runner Ubuntu
- Clona repositorio

#### 3. Autenticación
- Usa `GCP_SA_KEY` secret
- Autentica con Service Account
- Obtiene permisos necesarios

#### 4. Build
- Cloud Build construye imagen Docker automáticamente desde código fuente
- Detecta `requirements.txt` → instala dependencias Python
- Detecta `Procfile` o usa `uvicorn` por defecto
- Crea imagen optimizada

#### 5. Deployment
- Sube imagen a Artifact Registry
- Despliega nueva revisión en Cloud Run
- Configura secrets desde Secret Manager
- Configura variables de entorno
- Aplica configuración de red y permisos

#### 6. Health Check
- Cloud Run verifica que el servicio responda
- Espera endpoint `/health` (si existe)
- Timeout: 300 segundos

#### 7. Activación
- Si todo OK → nueva versión recibe 100% del tráfico
- Si falla → mantiene versión anterior (rollback automático)

#### 8. Notificación
- GitHub Actions muestra resultado
- Email si está configurado
- Badge en README se actualiza

### Tiempos Estimados

| Fase | Tiempo |
|------|--------|
| Checkout | 5-10 seg |
| Autenticación | 5 seg |
| Setup SDK | 10-15 seg |
| Build | 2-5 min |
| Deploy | 30-60 seg |
| Health Check | 10-30 seg |
| **TOTAL** | **3-7 min** |

---

## 🔍 Monitoreo y Logs

### Ver Ejecuciones del Workflow

**GitHub:**
1. Ir a https://github.com/gustavo2866/sistemika_dev
2. Pestaña **Actions**
3. Seleccionar workflow "Deploy to GCP Cloud Run"
4. Ver historial de runs

**Información disponible:**
- ✅ Estado (Success/Failure)
- ⏱️ Duración
- 📝 Logs detallados de cada step
- 🔄 Posibilidad de re-ejecutar

### Ver Logs de Cloud Run

#### Desde Console:
1. https://console.cloud.google.com/run
2. Seleccionar `sak-backend`
3. Pestaña **LOGS**

#### Desde CLI:
```bash
# Últimos 50 logs
gcloud run services logs read sak-backend --region us-central1 --limit 50

# Logs en tiempo real
gcloud run services logs tail sak-backend --region us-central1

# Filtrar por nivel
gcloud run services logs read sak-backend --region us-central1 --log-filter='severity>=ERROR'

# Exportar logs
gcloud run services logs read sak-backend --region us-central1 --format=json > logs.json
```

### Métricas del Servicio

**Console → Cloud Run → sak-backend → METRICS:**
- Requests per second
- Request latency
- Container instance count
- CPU utilization
- Memory utilization

---

## 🐛 Troubleshooting

### Problemas Comunes

#### 1. Error: "Permission denied"

**Síntoma:**
```
ERROR: (gcloud.run.deploy) Permission denied
```

**Causa:** Service Account sin permisos suficientes

**Solución:**
```bash
# Verificar roles del Service Account
gcloud projects get-iam-policy sak-wcl \
  --flatten="bindings[].members" \
  --filter="bindings.members:sak-wcl-service@sak-wcl.iam.gserviceaccount.com"

# Agregar roles necesarios
gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding sak-wcl \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

#### 2. Error: "Secret not found"

**Síntoma:**
```
ERROR: Secret [DATABASE_URL] not found
```

**Causa:** Secret no existe en Secret Manager

**Solución:**
```bash
# Crear el secret
echo "postgresql://user:pass@host/db" | \
  gcloud secrets create DATABASE_URL \
  --data-file=- \
  --project=sak-wcl

# Dar permisos al Service Account
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=sak-wcl
```

#### 3. Error: "Build failed"

**Síntoma:**
```
ERROR: failed to build: error building image
```

**Causas posibles:**
- Error de sintaxis en Python
- Dependencia faltante en `requirements.txt`
- Archivo no encontrado

**Solución:**
1. Revisar logs del build en GitHub Actions
2. Probar build localmente:
   ```bash
   cd sak/backend
   docker build -t test-build .
   ```
3. Verificar que todos los archivos necesarios estén en el repo

#### 4. Error: "Health check failed"

**Síntoma:**
```
ERROR: Revision failed with: Container failed to start
```

**Causas posibles:**
- Aplicación no inicia correctamente
- Puerto incorrecto
- Dependencia de DB no disponible

**Solución:**
1. Ver logs del container:
   ```bash
   gcloud run services logs read sak-backend --limit 100
   ```
2. Verificar que `Procfile` o comando de inicio sea correcto
3. Probar localmente con las mismas variables de entorno
4. Verificar conectividad a base de datos

#### 5. Workflow no se ejecuta

**Síntoma:** Push a master pero no hay ejecución

**Causas posibles:**
- Archivo `.github/workflows/deploy-gcp.yml` no existe
- Sintaxis YAML incorrecta
- Branch name incorrecto

**Solución:**
1. Verificar que el archivo existe en el root del repo
2. Validar sintaxis YAML: https://www.yamllint.com/
3. Verificar en GitHub Actions si hay errores de configuración
4. Confirmar que estás en branch `master`: `git branch`

---

## 📚 Comandos Útiles

### GitHub Actions

```bash
# Ver estado del último workflow
gh run list --workflow=deploy-gcp.yml --limit 1

# Ver logs de una ejecución
gh run view <run_id> --log

# Re-ejecutar último workflow
gh run rerun <run_id>

# Cancelar ejecución en curso
gh run cancel <run_id>
```

### Cloud Run

```bash
# Ver servicios
gcloud run services list --region us-central1

# Describir servicio
gcloud run services describe sak-backend --region us-central1

# Ver revisiones
gcloud run revisions list --service sak-backend --region us-central1

# Rollback a revisión anterior
gcloud run services update-traffic sak-backend \
  --to-revisions=<revision_name>=100 \
  --region us-central1

# Ver variables de entorno
gcloud run services describe sak-backend \
  --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'

# Actualizar variable de entorno
gcloud run services update sak-backend \
  --update-env-vars KEY=value \
  --region us-central1
```

### Secret Manager

```bash
# Listar secrets
gcloud secrets list --project=sak-wcl

# Ver contenido de un secret (última versión)
gcloud secrets versions access latest --secret=DATABASE_URL --project=sak-wcl

# Crear secret desde archivo
gcloud secrets create NEW_SECRET --data-file=secret.txt --project=sak-wcl

# Actualizar secret
echo "new_value" | gcloud secrets versions add DATABASE_URL --data-file=- --project=sak-wcl

# Eliminar secret
gcloud secrets delete SECRET_NAME --project=sak-wcl
```

---

## 🔗 Links Útiles

| Recurso | URL |
|---------|-----|
| **GitHub Actions Runs** | https://github.com/gustavo2866/sistemika_dev/actions |
| **GCP Cloud Run Console** | https://console.cloud.google.com/run?project=sak-wcl |
| **GCP Secret Manager** | https://console.cloud.google.com/security/secret-manager?project=sak-wcl |
| **Backend Producción** | https://sak-backend-94464199991.us-central1.run.app |
| **API Docs Producción** | https://sak-backend-94464199991.us-central1.run.app/docs |
| **Frontend Producción** | https://sistemika-sak-frontend.vercel.app |

---

## 📝 Notas Importantes

### Seguridad

- ⚠️ **NUNCA** commitear el archivo `GCP_SA_KEY.json` al repositorio
- ✅ Usar siempre GitHub Secrets para credenciales
- ✅ Rotar secrets periódicamente (cada 90 días recomendado)
- ✅ Limitar permisos del Service Account al mínimo necesario
- ✅ Habilitar audit logging en GCP

### Mejores Prácticas

- 📋 Usar branches feature y PRs antes de merge a `master`
- 🧪 Tener ambiente de staging (branch `develop` → otro Cloud Run)
- 📊 Monitorear métricas y logs regularmente
- 🔄 Implementar rollback strategy documentada
- 📝 Documentar cambios en el workflow en commit messages

### Costos

El workflow de GitHub Actions es **GRATIS** para repositorios públicos.

Cloud Run cobra por:
- CPU time (durante requests)
- Memory usage
- Requests
- Network egress

**Optimizaciones:**
- Usar `--min-instances=0` (default) para escalar a cero cuando no hay tráfico
- Configurar CPU allocation: `--cpu-throttling` (solo durante requests)
- Monitorear y ajustar memory limits

---

## 🔄 Actualizaciones del Workflow

### Cómo Modificar

1. **Editar archivo:**
   ```bash
   cd c:\Users\gpalmieri\source\sistemika
   code .github\workflows\deploy-gcp.yml
   ```

2. **Hacer cambios** (ejemplo: agregar nuevo step):
   ```yaml
   - name: Run tests
     run: |
       cd sak/backend
       pip install pytest
       pytest tests/
   ```

3. **Commit y push:**
   ```bash
   git add .github/workflows/deploy-gcp.yml
   git commit -m "feat: add automated tests to deployment"
   git push origin master
   ```

4. **Verificar ejecución** en GitHub Actions

### Template para Nuevos Workflows

```yaml
name: Nombre del Workflow

on:
  push:
    branches:
      - master
    paths:
      - 'sak/backend/**'  # Solo si cambia backend

env:
  PROJECT_ID: sak-wcl

jobs:
  tu-job:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Tu step
        run: echo "Hola mundo"
```

---

## ✅ Validación de Configuración

Antes de hacer deploy, puedes validar que todo esté configurado correctamente:

```powershell
# Ejecutar script de validación
cd c:\Users\gpalmieri\source\sistemika\sak
.\doc\deployment\validate-github-actions.ps1
```

**El script verifica:**
- ✓ Archivo workflow existe y está bien configurado
- ✓ Autenticación GCP correcta
- ✓ Service Account con roles necesarios
- ✓ Servicio Cloud Run activo y funcional
- ✓ Variables de entorno configuradas
- ✓ Secrets referenciados correctamente
- ✓ Conectividad al servicio
- ✓ Último deployment exitoso

**Output esperado:**
```
==================================================
  VALIDACIÓN DE GITHUB ACTIONS + GCP CLOUD RUN
==================================================

[1/8] Verificando archivo workflow...
✓ Archivo workflow existe
✓ Trigger configurado correctamente (push a master)
...

✅ VALIDACIÓN EXITOSA - GitHub Actions está correctamente configurado
```

---

## 📞 Soporte

Si tienes problemas con el deployment:

1. ✅ **Ejecutar script de validación** (ver arriba)
2. ✅ Revisar logs en GitHub Actions
3. ✅ Revisar logs en Cloud Run
4. ✅ Consultar esta documentación
5. ✅ Verificar que todos los secrets estén configurados
6. ✅ Probar deployment manual con `gcloud` CLI

**Documentación oficial:**
- GitHub Actions: https://docs.github.com/en/actions
- Cloud Run: https://cloud.google.com/run/docs
- gcloud CLI: https://cloud.google.com/sdk/gcloud/reference/run

---

*Última actualización: Noviembre 2025*
