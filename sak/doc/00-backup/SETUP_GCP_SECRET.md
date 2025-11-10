# 🔑 Configurar GCP_SA_KEY - Guía Paso a Paso

## Opción 1: Crear la clave desde GCP Cloud Console

### Paso 1: Generar la clave de la cuenta de servicio

1. Ve a [GCP Console - Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=sak-wcl)

2. Busca la cuenta de servicio: `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`

3. Click en los 3 puntos (⋮) a la derecha → **Manage keys**

4. Click en **Add Key** → **Create new key**

5. Selecciona **JSON** → Click **Create**

6. Se descargará un archivo JSON (ejemplo: `sak-wcl-1234567890.json`)

7. **Renombra** el archivo a `gcp-credentials.json`

8. **Muévelo** a la carpeta `backend/` de tu proyecto

### Paso 2: Ejecutar el script de configuración

```powershell
cd backend
.\setup-github-secret.ps1
```

El script:
- ✅ Lee el archivo `gcp-credentials.json`
- ✅ Lo codifica en base64
- ✅ Lo copia al portapapeles
- ✅ Te guía para agregarlo a GitHub

### Paso 3: Agregar el secreto a GitHub

Sigue las instrucciones que aparecerán en pantalla:

1. Ve a: https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions
2. Click en **New repository secret**
3. Name: `GCP_SA_KEY`
4. Value: Pega el contenido del portapapeles (Ctrl+V)
5. Click **Add secret**

---

## Opción 2: Usar gcloud CLI

Si tienes `gcloud` instalado localmente:

### Paso 1: Generar la clave

```powershell
# En PowerShell
cd backend

gcloud iam service-accounts keys create gcp-credentials.json `
  --iam-account=sak-wcl-service@sak-wcl.iam.gserviceaccount.com `
  --project=sak-wcl
```

### Paso 2: Ejecutar el script

```powershell
.\setup-github-secret.ps1
```

---

## Opción 3: Manual (si ya tienes el archivo JSON)

### Paso 1: Codificar el archivo

```powershell
cd backend

# Leer y codificar
$content = Get-Content -Path gcp-credentials.json -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard

Write-Host "✅ Contenido copiado al portapapeles"
```

### Paso 2: Agregar a GitHub

1. Ve a: https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions
2. Click **New repository secret**
3. Name: `GCP_SA_KEY`
4. Value: Pega (Ctrl+V)
5. Click **Add secret**

---

## Verificar permisos de la cuenta de servicio

La cuenta debe tener estos roles:

```bash
# Ejecuta en GCP Cloud Shell o con gcloud configurado:

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

---

## ⚠️ Seguridad

- ✅ El archivo `gcp-credentials.json` está en `.gitignore`
- ✅ NO se subirá al repositorio
- ✅ Es seguro tenerlo localmente
- ❌ NUNCA lo compartas públicamente
- ❌ NUNCA lo commitees a Git

---

## ✅ Verificar configuración

Después de agregar el secreto en GitHub:

1. Ve a: https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions
2. Deberías ver: `GCP_SA_KEY` ✅
3. No podrás ver su valor (por seguridad)

---

## 🚀 Probar el workflow

Una vez configurado:

```powershell
# 1. Hacer un cambio
echo "test" > test.txt

# 2. Commit y push
git add .
git commit -m "test: verificar deploy automático"
git push origin gcp

# 3. Verificar en GitHub Actions
# https://github.com/gustavo2866/sistemika_dev/actions
```

---

## 🔗 Enlaces útiles

- [GCP Service Accounts Console](https://console.cloud.google.com/iam-admin/serviceaccounts?project=sak-wcl)
- [GitHub Secrets](https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions)
- [GitHub Actions](https://github.com/gustavo2866/sistemika_dev/actions)
