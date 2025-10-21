# 🔐 Variables de Entorno para Backend en GCP

Documentación completa de todas las variables de entorno necesarias para el deploy del backend en Google Cloud Platform.

---

## 📋 Variables OBLIGATORIAS

### 1. Base de Datos (PostgreSQL)

#### `DATABASE_URL` ⚠️ **CRÍTICO**
- **Descripción:** URL de conexión completa a la base de datos PostgreSQL (Neon)
- **Formato:** `postgresql+psycopg://usuario:password@host:puerto/database`
- **Ejemplo:** 
  ```
  postgresql+psycopg://user:pass@ep-aged-bonus-123456.us-east-2.aws.neon.tech/sak?sslmode=require
  ```
- **Nota:** Si tu URL de Neon no incluye `?sslmode=require`, agrégalo al final
- **Dónde obtenerla:** Neon Dashboard → Connection String

---

### 2. Google Cloud Storage (GCS)

#### `GCS_BUCKET_NAME` ⚠️ **CRÍTICO**
- **Descripción:** Nombre del bucket de Google Cloud Storage para almacenar archivos
- **Formato:** `nombre-del-bucket`
- **Ejemplo:** `sak-facturas-prod` o `sistemika-invoices`
- **Nota:** El bucket debe existir previamente en GCP
- **Dónde crearlo:** GCP Console → Cloud Storage → Buckets

#### `GCS_PROJECT_ID` ⚠️ **CRÍTICO**
- **Descripción:** ID del proyecto de Google Cloud Platform
- **Formato:** `project-id-123456`
- **Ejemplo:** `sistemika-prod-2025` o `sak-invoices`
- **Dónde obtenerlo:** GCP Console → Dashboard (arriba, nombre del proyecto)

#### `GOOGLE_APPLICATION_CREDENTIALS` ⚠️ **CRÍTICO**
- **Descripción:** Ruta al archivo JSON con las credenciales de la cuenta de servicio GCP
- **Formato (Local):** `/path/to/service-account-key.json`
- **Formato (GCP Cloud Run/App Engine):** 
  - **Opción 1:** Contenido completo del JSON como string
  - **Opción 2:** Usar Application Default Credentials (recomendado en GCP)
- **Ejemplo Local:** 
  ```
  /home/user/gcp-credentials.json
  ```
- **Ejemplo Cloud (variable con JSON):**
  ```json
  {
    "type": "service_account",
    "project_id": "sistemika-prod",
    "private_key_id": "abc123...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...",
    "client_email": "sak-backend@sistemika-prod.iam.gserviceaccount.com",
    "client_id": "123456789",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
  }
  ```
- **Cómo crear:**
  1. GCP Console → IAM & Admin → Service Accounts
  2. Create Service Account → Nombre: `sak-backend`
  3. Grant roles: `Storage Object Admin` (o `Storage Admin`)
  4. Create Key → JSON → Download
  
**⚠️ IMPORTANTE para GCP Cloud Run/App Engine:**
- Si deployeas en Cloud Run o App Engine con la misma cuenta de servicio, puedes omitir esta variable
- El servicio usará Application Default Credentials automáticamente

---

### 3. OpenAI (Procesamiento de Facturas con IA)

#### `OPENAI_API_KEY` ⚠️ **CRÍTICO**
- **Descripción:** Clave API de OpenAI para procesamiento de facturas con visión GPT-4
- **Formato:** `sk-proj-...` o `sk-...`
- **Ejemplo:** `sk-proj-ABC123XYZ789...`
- **Dónde obtenerla:** https://platform.openai.com/api-keys
- **Costo:** Ten en cuenta que GPT-4 Vision consume créditos
- **Nota:** Si no la configuras, el procesamiento de facturas con IA no funcionará

---

### 4. Seguridad (JWT)

#### `JWT_SECRET` ⚠️ **CRÍTICO**
- **Descripción:** Clave secreta para firmar tokens JWT de autenticación
- **Formato:** String aleatorio largo (mínimo 32 caracteres)
- **Ejemplo:** `super-secret-key-change-this-in-production-abc123xyz789`
- **Cómo generar:**
  ```bash
  # Python
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  
  # OpenSSL
  openssl rand -base64 32
  
  # PowerShell
  [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  ```
- **⚠️ NUNCA uses el valor por defecto en producción**

---

## 📋 Variables OPCIONALES (con valores por defecto)

### 5. Entorno y Configuración

#### `ENV`
- **Descripción:** Ambiente de ejecución
- **Valores:** `dev`, `staging`, `prod`
- **Default:** `dev`
- **Ejemplo:** `prod`
- **Uso:** Determina comportamientos como logging, validaciones, etc.

#### `SQLALCHEMY_ECHO`
- **Descripción:** Habilita logging de queries SQL en consola
- **Valores:** `0` (deshabilitado) o `1` (habilitado)
- **Default:** `0`
- **Ejemplo:** `1` (útil para debug)
- **⚠️ NO habilitar en producción** (impacto en performance)

---

### 6. CORS (Cross-Origin Resource Sharing)

#### `CORS_ORIGINS`
- **Descripción:** Orígenes permitidos para requests cross-origin
- **Formato:** Lista separada por comas
- **Default:** `http://localhost:3000,http://localhost:5173,http://localhost:8080`
- **Ejemplo Producción:** 
  ```
  https://sak.sistemika.com,https://admin.sistemika.com,https://sistemika-frontend.vercel.app
  ```
- **Nota:** Incluye todas las URLs de tu frontend

---

### 7. Google Cloud Storage (Configuración Adicional)

#### `GCS_INVOICE_FOLDER`
- **Descripción:** Carpeta dentro del bucket para almacenar facturas
- **Default:** `facturas`
- **Ejemplo:** `invoices` o `documentos/facturas`

#### `GCS_SIGNED_URL_SECONDS`
- **Descripción:** Tiempo de validez (en segundos) de las URLs firmadas
- **Default:** `86400` (24 horas)
- **Ejemplo:** `3600` (1 hora) o `604800` (7 días)

#### `BUCKET_NAME` (alias legacy)
- **Descripción:** Nombre del bucket (alias de GCS_BUCKET_NAME)
- **Default:** Usa `GCS_BUCKET_NAME` si existe
- **Nota:** Mantener por compatibilidad, usar `GCS_BUCKET_NAME`

---

## 🚀 Configuración en Google Cloud Platform

### Opción 1: Cloud Run (Recomendado)

1. **Crear Service Account:**
   ```bash
   gcloud iam service-accounts create sak-backend \
     --display-name="SAK Backend Service Account"
   ```

2. **Dar permisos al bucket:**
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:sak-backend@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.objectAdmin"
   ```

3. **Deploy con variables de entorno:**
   ```bash
   gcloud run deploy sak-backend \
     --source . \
     --region us-central1 \
     --set-env-vars DATABASE_URL="postgresql+psycopg://..." \
     --set-env-vars GCS_BUCKET_NAME="sak-facturas-prod" \
     --set-env-vars GCS_PROJECT_ID="sistemika-prod" \
     --set-env-vars OPENAI_API_KEY="sk-proj-..." \
     --set-env-vars JWT_SECRET="your-generated-secret" \
     --set-env-vars ENV="prod" \
     --set-env-vars CORS_ORIGINS="https://yourfrontend.com" \
     --service-account sak-backend@PROJECT_ID.iam.gserviceaccount.com
   ```

4. **Si usas Application Default Credentials (recomendado):**
   - NO necesitas `GOOGLE_APPLICATION_CREDENTIALS`
   - El servicio usa la identidad de la service account automáticamente

---

### Opción 2: App Engine

1. Crear `app.yaml`:
   ```yaml
   runtime: python312
   
   env_variables:
     ENV: "prod"
     DATABASE_URL: "postgresql+psycopg://user:pass@host/db?sslmode=require"
     GCS_BUCKET_NAME: "sak-facturas-prod"
     GCS_PROJECT_ID: "sistemika-prod"
     OPENAI_API_KEY: "sk-proj-..."
     JWT_SECRET: "your-generated-secret"
     CORS_ORIGINS: "https://yourfrontend.com"
   
   automatic_scaling:
     min_instances: 1
     max_instances: 10
   ```

2. Deploy:
   ```bash
   gcloud app deploy
   ```

---

### Opción 3: Compute Engine (VM)

1. **SSH a la VM:**
   ```bash
   gcloud compute ssh your-instance-name
   ```

2. **Crear archivo `.env`:**
   ```bash
   nano /home/backend/.env
   ```

3. **Agregar variables:**
   ```env
   ENV=prod
   DATABASE_URL=postgresql+psycopg://user:pass@host/db?sslmode=require
   GCS_BUCKET_NAME=sak-facturas-prod
   GCS_PROJECT_ID=sistemika-prod
   GOOGLE_APPLICATION_CREDENTIALS=/home/backend/gcp-credentials.json
   OPENAI_API_KEY=sk-proj-...
   JWT_SECRET=your-generated-secret
   CORS_ORIGINS=https://yourfrontend.com
   ```

4. **Copiar credenciales GCP:**
   ```bash
   gcloud compute scp gcp-credentials.json your-instance-name:/home/backend/
   ```

---

## 🔒 Mejores Prácticas de Seguridad

### ✅ DO's (Hacer):
1. **Usa Secret Manager de GCP para secrets sensibles**
   ```bash
   # Crear secret
   echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
   
   # Dar acceso a la service account
   gcloud secrets add-iam-policy-binding jwt-secret \
     --member="serviceAccount:sak-backend@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

2. **Rota credenciales regularmente**
   - JWT_SECRET cada 90 días
   - Service Account keys cada 6 meses

3. **Usa principio de mínimo privilegio**
   - Solo permisos necesarios en GCS (Storage Object Admin, no Storage Admin)

4. **Habilita audit logging**
   ```bash
   gcloud logging read "resource.type=gcs_bucket AND resource.labels.bucket_name=sak-facturas-prod"
   ```

### ❌ DON'Ts (No hacer):
1. ❌ NUNCA commiteés archivos `.env` o credenciales al repositorio
2. ❌ NUNCA uses el JWT_SECRET por defecto en producción
3. ❌ NUNCA compartas las credenciales de GCP públicamente
4. ❌ NUNCA uses `Storage Admin` si solo necesitas `Storage Object Admin`

---

## 📝 Template de `.env` para desarrollo local

```env
# Entorno
ENV=dev

# Base de datos (Neon)
DATABASE_URL=postgresql+psycopg://user:password@ep-xyz.us-east-2.aws.neon.tech/sak?sslmode=require

# Google Cloud Storage
GCS_BUCKET_NAME=sak-facturas-dev
GCS_PROJECT_ID=sistemika-dev
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
GCS_INVOICE_FOLDER=facturas
GCS_SIGNED_URL_SECONDS=86400

# OpenAI
OPENAI_API_KEY=sk-proj-your-key-here

# Seguridad
JWT_SECRET=dev-secret-change-in-production

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Debug (opcional)
SQLALCHEMY_ECHO=0
```

---

## 🧪 Verificación de Variables

Ejecuta este script para verificar que todas las variables están configuradas:

```python
# check_env.py
import os
from dotenv import load_dotenv

load_dotenv()

required_vars = {
    "DATABASE_URL": "Base de datos PostgreSQL",
    "GCS_BUCKET_NAME": "Bucket de Google Cloud Storage",
    "GCS_PROJECT_ID": "ID del proyecto GCP",
    "OPENAI_API_KEY": "API Key de OpenAI",
    "JWT_SECRET": "Secret para JWT",
}

optional_vars = {
    "ENV": "dev",
    "CORS_ORIGINS": "http://localhost:3000",
    "GOOGLE_APPLICATION_CREDENTIALS": "Auto-detect en GCP",
    "GCS_INVOICE_FOLDER": "facturas",
    "GCS_SIGNED_URL_SECONDS": "86400",
    "SQLALCHEMY_ECHO": "0",
}

print("🔍 Verificando variables de entorno requeridas:\n")

all_ok = True
for var, desc in required_vars.items():
    value = os.getenv(var)
    if value:
        masked = value[:10] + "..." if len(value) > 10 else value
        print(f"✅ {var}: {masked}")
    else:
        print(f"❌ {var}: NO CONFIGURADA - {desc}")
        all_ok = False

print("\n📋 Variables opcionales:\n")
for var, default in optional_vars.items():
    value = os.getenv(var, default)
    print(f"ℹ️  {var}: {value[:50]}...")

if all_ok:
    print("\n✅ Todas las variables requeridas están configuradas!")
else:
    print("\n⚠️ Faltan variables requeridas. Revisa la configuración.")
```

---

## 📞 Soporte

Si tienes problemas con la configuración:

1. **Logs de Cloud Run:**
   ```bash
   gcloud run services logs read sak-backend --region us-central1
   ```

2. **Test de conectividad a Neon:**
   ```bash
   python test_neon_connection.py
   ```

3. **Test de GCS:**
   ```bash
   python test_gcs_integration.py
   ```

---

**Última actualización:** 11 de Octubre, 2025  
**Versión:** 1.0.0
