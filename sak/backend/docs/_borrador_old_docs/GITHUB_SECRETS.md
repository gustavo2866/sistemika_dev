# 🔐 Configuración de Secretos en GitHub

Este documento explica cómo configurar el secreto `GCP_SA_KEY` necesario para el deploy automático a GCP Cloud Run.

## ¿Qué es GCP_SA_KEY?

Es la **clave privada del Service Account de GCP** en formato JSON (codificada en base64), que permite que GitHub Actions se autentique en GCP para desplegar la aplicación.

---

## 📋 Pasos para Configurar el Secreto

### 1️⃣ **Obtener la Clave del Service Account**

Ya tienes el archivo `backend/gcp-credentials.json` con las credenciales. Este archivo contiene:

```json
{
  "type": "service_account",
  "project_id": "sak-wcl",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "sak-wcl-service@sak-wcl.iam.gserviceaccount.com",
  ...
}
```

---

### 2️⃣ **Codificar el Archivo en Base64**

#### En PowerShell (Windows):
```powershell
# Navega al directorio backend
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Codifica el archivo en base64
$fileContent = Get-Content -Path "gcp-credentials.json" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($fileContent)
$base64 = [Convert]::ToBase64String($bytes)

# Copia al portapapeles
$base64 | Set-Clipboard

Write-Host "✅ Clave codificada y copiada al portapapeles" -ForegroundColor Green
```

#### Alternativa (sin codificar - GitHub lo hace automáticamente):
Puedes copiar **directamente el contenido JSON completo** de `gcp-credentials.json`.

---

### 3️⃣ **Agregar el Secreto en GitHub**

1. **Ve a tu repositorio en GitHub:**
   ```
   https://github.com/gustavo2866/sistemika_dev
   ```

2. **Navega a Settings:**
   - Click en **Settings** (esquina superior derecha)

3. **Ve a Secrets and Variables:**
   - En el menú lateral izquierdo, click en **Secrets and variables** → **Actions**

4. **Crea un nuevo secreto:**
   - Click en **New repository secret**
   - **Name:** `GCP_SA_KEY`
   - **Value:** Pega el contenido que copiaste (base64 o JSON directo)
   - Click en **Add secret**

---

## ✅ Verificación

Después de agregar el secreto:

1. **El secreto debe aparecer listado:**
   ```
   GCP_SA_KEY
   Updated [timestamp]
   ```

2. **Puedes verificar que funciona haciendo un push a master:**
   ```powershell
   # Ejecuta el deploy
   .\deploy-to-production.ps1
   
   # Monitorea en GitHub Actions
   # https://github.com/gustavo2866/sistemika_dev/actions
   ```

---

## 🔒 Seguridad

### **IMPORTANTE:**
- ❌ **NUNCA** hagas commit del archivo `gcp-credentials.json` al repositorio
- ❌ **NUNCA** compartas el secreto `GCP_SA_KEY` públicamente
- ✅ El archivo `gcp-credentials.json` ya está en `.gitignore`
- ✅ Los secretos de GitHub están encriptados y seguros

### **Verificar .gitignore:**
```gitignore
# GCP Credentials
gcp-credentials.json
*.json
!package*.json
!tsconfig.json
```

---

## 🔄 Renovar el Service Account Key (si es necesario)

Si necesitas generar una nueva clave:

1. **Ve a GCP Console:**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=sak-wcl
   ```

2. **Selecciona el Service Account:**
   ```
   sak-wcl-service@sak-wcl.iam.gserviceaccount.com
   ```

3. **Ve a Keys:**
   - Click en **Keys** (pestaña)
   - Click en **Add Key** → **Create new key**
   - Selecciona **JSON**
   - Click en **Create**

4. **Descarga el archivo JSON** y reemplaza `gcp-credentials.json`

5. **Actualiza el secreto en GitHub** siguiendo los pasos anteriores

---

## 📦 Permisos del Service Account

El Service Account debe tener estos roles en GCP:

```
✅ roles/run.admin              # Para desplegar a Cloud Run
✅ roles/storage.objectAdmin    # Para manejar Cloud Storage
✅ roles/iam.serviceAccountUser # Para actuar como Service Account
```

Estos permisos ya están configurados para: `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`

---

## 🛠️ Troubleshooting

### Error: "invalid key format"
- Verifica que copiaste **todo** el contenido JSON
- Asegúrate de que no hay espacios o saltos de línea extra

### Error: "permission denied"
- Verifica que el Service Account tiene los roles correctos
- Verifica que el Service Account está habilitado

### Error: "secret not found"
- Verifica que el nombre del secreto es exactamente `GCP_SA_KEY` (mayúsculas)
- Verifica que estás en el repositorio correcto

---

## 📚 Referencias

- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GCP Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/overview)
