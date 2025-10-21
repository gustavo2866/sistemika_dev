# 📦 Google Cloud Storage - Almacenamiento de Facturas

Configuración y uso del bucket GCS para almacenar PDFs de facturas.

---

## Resumen

- **Bucket:** `sak-wcl-bucket`
- **Región:** southamerica-east1 (São Paulo)
- **Acceso:** Público (allUsers:objectViewer)
- **Uso:** Almacenar PDFs de facturas procesadas

---

## Arquitectura

```
Frontend (upload PDF)
    ↓
Backend FastAPI
    ↓
OpenAI (extracción LLM)
    ↓
PostgreSQL (metadata)
    ↓
GCS (archivo PDF)
    ↓
URL pública permanente
```

---

## Configuración Actual

### Bucket Público

El bucket fue configurado como público el **19/10/2025** para:

- ✅ Evitar expiración de URLs (signed URLs expiran en 7 días máximo)
- ✅ Simplificar arquitectura (no requiere re-generación de URLs)
- ✅ Permitir acceso directo desde frontend

**Comando usado:**
```bash
gsutil iam ch allUsers:objectViewer gs://sak-wcl-bucket
```

### URLs Públicas

Formato de URL:
```
https://storage.googleapis.com/sak-wcl-bucket/facturas/{filename}
```

**Ejemplo:**
```
https://storage.googleapis.com/sak-wcl-bucket/facturas/20251019_224300_00003-00182988%20(Factura%20A).pdf
```

---

## Variables de Entorno

### En Desarrollo (.env)

```bash
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas

# Credenciales locales (descargadas de GCP)
GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/gcp-credentials.json
```

### En Producción (Cloud Run)

```bash
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas

# NO necesita GOOGLE_APPLICATION_CREDENTIALS
# Cloud Run usa Application Default Credentials automáticamente
```

---

## Uso en el Código

### Servicio GCS

**Archivo:** `backend/app/services/gcs_storage_service.py`

```python
from app.services.gcs_storage_service import storage_service

# Upload de archivo
result = storage_service.upload_invoice(
    file_path="/tmp/factura.pdf",
    filename="factura_001.pdf"
)

# Resultado
{
    "storage_uri": "gs://sak-wcl-bucket/facturas/factura_001.pdf",
    "download_url": "https://storage.googleapis.com/sak-wcl-bucket/facturas/factura_001.pdf",
    "blob_name": "facturas/factura_001.pdf",
    "bucket": "sak-wcl-bucket"
}
```

### Endpoint de Upload

**POST** `/api/v1/facturas/parse-pdf/`

```python
# Upload PDF
files = {"file": open("factura.pdf", "rb")}
response = requests.post(
    "https://sak-backend-94464199991.us-central1.run.app/api/v1/facturas/parse-pdf/",
    files=files
)

# Respuesta incluye:
{
    "ruta_archivo_pdf": "https://storage.googleapis.com/sak-wcl-bucket/facturas/...",
    "storage_uri": "gs://sak-wcl-bucket/facturas/...",
    "gcs_blob_name": "facturas/..."
}
```

---

## Estructura del Bucket

```
gs://sak-wcl-bucket/
└── facturas/
    ├── 20251019_224300_00003-00182988 (Factura A).pdf
    ├── 20251018_153000_00002-12345678 (Factura B).pdf
    └── ...
```

### Nombrado de Archivos

Formato: `{timestamp}_{nombre_original}.pdf`

**Ejemplo:**
- Original: `00003-00182988 (Factura A).pdf`
- Guardado: `20251019_224300_00003-00182988 (Factura A).pdf`

Beneficios:
- ✅ Evita colisiones (timestamp único)
- ✅ Mantiene nombre original (trazabilidad)
- ✅ Ordenamiento cronológico

---

## Permisos del Service Account

**Service Account:** `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`

**Roles necesarios:**
- `roles/storage.objectAdmin` - Crear/leer/escribir objetos
- `roles/storage.buckets.get` - Acceder al bucket

**Comando para dar permisos:**
```bash
gsutil iam ch \
  serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com:objectAdmin \
  gs://sak-wcl-bucket
```

---

## Operaciones Comunes

### Listar Archivos

```bash
# Todos los archivos
gsutil ls gs://sak-wcl-bucket/facturas/

# Con detalles
gsutil ls -l gs://sak-wcl-bucket/facturas/

# Recursivo
gsutil ls -r gs://sak-wcl-bucket/
```

### Descargar Archivo

```bash
gsutil cp gs://sak-wcl-bucket/facturas/archivo.pdf ./
```

### Eliminar Archivo

```bash
gsutil rm gs://sak-wcl-bucket/facturas/archivo.pdf
```

### Ver Permisos

```bash
gsutil iam get gs://sak-wcl-bucket
```

### Verificar que es Público

```bash
curl -I https://storage.googleapis.com/sak-wcl-bucket/facturas/archivo.pdf
# Debe responder 200 OK sin autenticación
```

---

## Seguridad

### ¿Por qué Público?

**Decisión:** Simplicidad y performance sobre seguridad para facturas internas.

**Alternativas consideradas:**
1. **Signed URLs con TTL corto** - Requiere re-generación periódica
2. **Signed URLs con TTL largo (7 días max)** - Sigue expirando
3. **Bucket público** ← **ELEGIDO** (simplicidad, cero latencia)

### Consideraciones

- ✅ **Pro:** URLs permanentes, sin expiración
- ✅ **Pro:** Cero latencia (no genera signed URLs)
- ✅ **Pro:** Fácil de usar desde frontend
- ⚠️ **Contra:** Cualquiera con la URL puede ver el PDF
- ⚠️ **Contra:** No hay control de acceso granular

### Mejora Futura (Fase 2)

Si se necesita seguridad:

1. Hacer bucket privado
2. Generar signed URLs on-demand desde backend
3. Cachear URLs en frontend (válidas por 24h)
4. Endpoint: `GET /api/v1/facturas/{id}/pdf-url`

---

## CORS Configuration

El bucket tiene CORS configurado para permitir acceso desde frontend:

```json
[
  {
    "origin": ["https://sistemika-sak-frontend.vercel.app", "http://localhost:3000"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

**Aplicar CORS:**
```bash
gsutil cors set cors.json gs://sak-wcl-bucket
```

---

## Monitoreo

### Ver Uso del Bucket

```bash
# Tamaño total
gsutil du -sh gs://sak-wcl-bucket

# Por carpeta
gsutil du -sh gs://sak-wcl-bucket/facturas/

# Número de archivos
gsutil ls gs://sak-wcl-bucket/facturas/ | wc -l
```

### Logs de Acceso

En GCP Console: **Cloud Storage → sak-wcl-bucket → Logs**

---

## Troubleshooting

### Error: "GCS_BUCKET_NAME environment variable is required"

**Causa:** Variable no configurada.

**Solución:**
```bash
# .env
GCS_BUCKET_NAME=sak-wcl-bucket
```

### Error: 403 Forbidden al subir

**Causa:** Service Account sin permisos.

**Solución:**
```bash
gsutil iam ch \
  serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com:objectAdmin \
  gs://sak-wcl-bucket
```

### Error: 404 Not Found al descargar

**Causa:** URL incorrecta o archivo no existe.

**Solución:**
```bash
# Verificar que el archivo existe
gsutil ls gs://sak-wcl-bucket/facturas/ | grep archivo.pdf
```

### URLs no son accesibles públicamente

**Causa:** Bucket no es público.

**Solución:**
```bash
gsutil iam ch allUsers:objectViewer gs://sak-wcl-bucket
```

---

## 📚 Ver También

- [Estructura del proyecto](project-structure.md)
- [Variables de entorno producción](../deployment/environment-prod.md)
- [Endpoint de facturas](../development/api-endpoints.md)
- [GCP Cloud Run](../deployment/gcp-cloud-run.md)
