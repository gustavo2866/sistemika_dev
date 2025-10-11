# 🔒 Seguridad de Credenciales GCP

## ✅ Estado Actual

### Archivos Protegidos

Los siguientes archivos de credenciales están **correctamente excluidos** de Git:

1. **`.gitignore` (raíz)**
   ```
   # Google Cloud Credentials
   gcp-credentials.json
   ```

2. **`backend/.gitignore`**
   ```
   # Google Cloud Credentials
   gcp-credentials.json
   *.json
   ```

3. **`backend/.gcloudignore`** (para deployment a GCP)
   ```
   gcp-credentials.json
   *.json
   ```

### Verificación Git

Ejecutado: `git ls-files | Select-String "gcp-credentials"`
✅ **Resultado:** Ningún archivo encontrado (no está en el repositorio)

Ejecutado: `git status --ignored`
✅ **Resultado:** Ambos archivos aparecen como ignorados:
- `backend/gcp-credentials.json`
- `gcp-credentials.json`

---

## 📋 Archivos de Credenciales Locales

Estos archivos **existen localmente** pero **NO se subirán** a Git ni a GCP:

```
sak/
├── gcp-credentials.json (2345 bytes) ✅ Ignorado
└── backend/
    └── gcp-credentials.json (2345 bytes) ✅ Ignorado
```

---

## 🚀 Deployment a GCP Cloud Run

Cuando deploys a Cloud Run:

### ❌ **NO** se incluirá:
- `gcp-credentials.json` (bloqueado por `.gcloudignore`)
- Archivos `.env` (contienen secretos)
- Carpetas `uploads/`, `temp/`, `__pycache__/`

### ✅ **SÍ** se incluirá:
- Código fuente (`app/`)
- `requirements.txt`
- `alembic/` (migraciones)
- `alembic.ini`

### 🔐 **Autenticación en Cloud Run:**
- **NO necesita** `gcp-credentials.json`
- Usa **Application Default Credentials (ADC)**
- La service account se asigna en Cloud Run Console:
  ```bash
  gcloud run deploy sak-backend \
    --service-account sak-wcl-service@sak-wcl.iam.gserviceaccount.com
  ```

---

## 🔑 Variables de Entorno

### Local (Desarrollo)
```bash
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_PROJECT_ID=sak-wcl
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
```

### Producción (GCP Cloud Run)
```bash
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_PROJECT_ID=sak-wcl
# GOOGLE_APPLICATION_CREDENTIALS=  ← NO configurar en GCP
```

---

## ⚠️ Importante

1. **NUNCA** hagas commit de `gcp-credentials.json`
2. **NUNCA** subas credenciales a GitHub/GitLab
3. Si accidentalmente hiciste commit de credenciales:
   - Revoca inmediatamente las credenciales en GCP Console
   - Genera nuevas credenciales
   - Limpia el historial de Git con `git filter-branch` o BFG Repo-Cleaner

---

## ✅ Checklist de Seguridad

- [x] `gcp-credentials.json` en `.gitignore` (raíz)
- [x] `gcp-credentials.json` en `backend/.gitignore`
- [x] `gcp-credentials.json` en `backend/.gcloudignore`
- [x] Archivos NO están en el repositorio Git
- [x] Archivos aparecen como ignorados en `git status`
- [x] Service account tiene permisos correctos en GCP
- [x] Código funciona con ADC en producción

---

## 📝 Referencias

- **Service Account**: `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`
- **Bucket**: `sak-wcl-bucket`
- **Project**: `sak-wcl`
- **Rol**: Administrador de objetos de Storage

---

Fecha de verificación: 2025-10-11
