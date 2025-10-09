# Guía de Despliegue en Vercel

Este documento describe los pasos para desplegar el sistema SAK en Vercel (frontend) y un servicio de backend compatible.

## 📋 Requisitos Previos

1. Cuenta en [Vercel](https://vercel.com)
2. Cuenta en [Railway](https://railway.app), [Render](https://render.com), o [Fly.io](https://fly.io) para el backend
3. Base de datos PostgreSQL (puede ser Railway, Supabase, Neon, etc.)
4. Repositorio Git (GitHub, GitLab, o Bitbucket)

## 🗄️ Paso 1: Configurar Base de Datos PostgreSQL

### Opción A: Railway (Recomendado)
1. Crear cuenta en [Railway](https://railway.app)
2. Crear nuevo proyecto → "Provision PostgreSQL"
3. Copiar la URL de conexión (formato: `postgresql://user:pass@host:port/db`)

### Opción B: Supabase
1. Crear cuenta en [Supabase](https://supabase.com)
2. Crear nuevo proyecto
3. Ir a Settings → Database → Connection string (modo "Session")

### Opción C: Neon
1. Crear cuenta en [Neon](https://neon.tech)
2. Crear nuevo proyecto
3. Copiar connection string

## 🐍 Paso 2: Desplegar Backend (FastAPI)

### Opción A: Railway

1. **Preparar el backend:**
```bash
cd backend
```

2. **Crear `railway.json` en `backend/`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

3. **Crear `Procfile` en `backend/`:**
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

4. **En Railway:**
   - Click "New Project" → "Deploy from GitHub repo"
   - Seleccionar el repositorio
   - Configurar Root Directory: `backend`
   - Agregar variables de entorno:
     - `DATABASE_URL`: URL de PostgreSQL
     - `OPENAI_API_KEY`: (si usas OpenAI)
     - `CORS_ORIGINS`: `https://tu-app.vercel.app`

5. **Ejecutar migraciones:**
   - Una vez desplegado, el backend creará las tablas automáticamente
   - Ejecutar seed: `python scripts/seed_sak_backend.py` (vía Railway CLI o custom script)

### Opción B: Render

1. **Crear `render.yaml` en la raíz:**
```yaml
services:
  - type: web
    name: sak-backend
    env: python
    region: oregon
    plan: free
    buildCommand: "cd backend && pip install -r requirements.txt"
    startCommand: "cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: CORS_ORIGINS
        value: https://tu-app.vercel.app
```

2. En Render Dashboard:
   - New → Web Service
   - Connect repository
   - Configurar variables de entorno

### Opción C: Fly.io

1. **Instalar Fly CLI:**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Crear `fly.toml` en `backend/`:**
```toml
app = "sak-backend"
primary_region = "iad"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8000"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[services]]
  protocol = "tcp"
  internal_port = 8000

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

3. **Desplegar:**
```bash
cd backend
fly launch
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set CORS_ORIGINS="https://tu-app.vercel.app"
fly deploy
```

## 🎨 Paso 3: Desplegar Frontend en Vercel

### 3.1 Preparar el Repositorio

1. **Commit todos los cambios:**
```bash
git add .
git commit -m "Preparar para despliegue en Vercel"
git push origin main
```

### 3.2 Configurar Vercel

1. **Ir a [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Import tu repositorio Git
   - Vercel detectará Next.js automáticamente

3. **Configurar el proyecto:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (o dejar por defecto)
   - **Output Directory:** `.next` (por defecto)
   - **Install Command:** `npm install` (por defecto)

4. **Variables de Entorno:**
   - Click "Environment Variables"
   - Agregar:
     ```
     NEXT_PUBLIC_API_URL = https://tu-backend.railway.app
     ```
     (Reemplazar con la URL de tu backend desplegado)

5. **Deploy:**
   - Click "Deploy"
   - Esperar a que termine el build (~2-3 minutos)

### 3.3 Configurar Dominio Personalizado (Opcional)

1. En Vercel Dashboard → Settings → Domains
2. Agregar tu dominio personalizado
3. Configurar DNS según las instrucciones

## 🔐 Paso 4: Configurar CORS en Backend

Asegúrate de que el backend permita requests desde Vercel:

**En `backend/app/main.py`:**
```python
from fastapi.middleware.cors import CORSMiddleware

# Obtener orígenes permitidos desde variable de entorno
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Configurar en Railway/Render/Fly:**
```
CORS_ORIGINS=https://tu-app.vercel.app,https://tu-dominio.com
```

## 🗃️ Paso 5: Inicializar Base de Datos

### Opción A: Manualmente con Railway CLI

```bash
railway link
railway run python backend/scripts/seed_sak_backend.py
```

### Opción B: Con script personalizado

Crear un endpoint en el backend para inicializar:

**En `backend/app/main.py`:**
```python
@app.post("/api/admin/init-db", tags=["admin"])
async def init_database(
    secret_key: str = Header(...),
    session: Session = Depends(get_session)
):
    """Inicializar base de datos con datos seed (solo una vez)"""
    if secret_key != os.getenv("ADMIN_SECRET_KEY"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Importar y ejecutar seed
    from scripts.seed_sak_backend import seed_all
    seed_all(session)
    
    return {"status": "Database initialized"}
```

Luego llamar con:
```bash
curl -X POST https://tu-backend.railway.app/api/admin/init-db \
  -H "secret-key: tu-clave-secreta"
```

## 🔍 Paso 6: Verificar Despliegue

### Frontend (Vercel)
1. Abrir `https://tu-app.vercel.app`
2. Verificar que cargue la interfaz
3. Abrir DevTools → Network para ver requests al backend

### Backend (Railway/Render/Fly)
1. Abrir `https://tu-backend.railway.app/docs`
2. Verificar que aparezca Swagger UI
3. Probar endpoint de salud:
```bash
curl https://tu-backend.railway.app/health
```

### Base de Datos
```bash
# Conectar con psql
psql "postgresql://user:pass@host:port/db"

# Verificar tablas
\dt

# Ver usuarios
SELECT * FROM users;
```

## 🚨 Troubleshooting

### Error: CORS bloqueado
- Verificar `CORS_ORIGINS` en backend incluye la URL de Vercel
- Reiniciar el backend después de cambiar variables

### Error: Cannot connect to database
- Verificar `DATABASE_URL` en backend
- Confirmar que la base de datos acepta conexiones externas
- Revisar logs del backend

### Error: 404 en API calls
- Verificar `NEXT_PUBLIC_API_URL` en Vercel
- Asegurarse de que termine sin `/` al final
- Ejemplo correcto: `https://backend.com` (sin trailing slash)

### Build fallido en Vercel
- Revisar logs de build
- Verificar que `Root Directory` sea `frontend`
- Confirmar que `package.json` tenga script `build`

### Backend no inicia en Railway
- Revisar logs: Railway Dashboard → Deployments → Logs
- Verificar que `requirements.txt` esté completo
- Confirmar que `uvicorn` esté en dependencies

## 📊 Monitoreo

### Vercel
- Dashboard → Analytics para ver tráfico
- Logs en tiempo real: `vercel logs`

### Railway
- Dashboard → Logs para ver requests
- Metrics para CPU/RAM/Network

### Base de Datos
- Railway: Dashboard → PostgreSQL → Metrics
- Supabase: Dashboard → Database → Statistics

## 🔄 Despliegues Continuos

Vercel y Railway/Render se conectan a tu repositorio Git:

1. **Push a main/master:**
```bash
git push origin main
```

2. **Auto-deploy:**
   - Vercel detecta cambios en `frontend/` → redeploy frontend
   - Railway detecta cambios en `backend/` → redeploy backend

3. **Preview Deployments (Vercel):**
   - Cada PR crea un preview deployment
   - URL única para testing: `https://tu-app-git-branch.vercel.app`

## 🔐 Seguridad

1. **Nunca commitear archivos sensibles:**
   - `.env.local` debe estar en `.gitignore`
   - Usar variables de entorno en Vercel/Railway

2. **Rotar credenciales:**
   - Cambiar `ADMIN_SECRET_KEY` después del primer deploy
   - Actualizar `DATABASE_URL` si se compromete

3. **HTTPS obligatorio:**
   - Vercel y Railway usan HTTPS por defecto
   - No permitir HTTP en producción

## 📝 Checklist de Deploy

- [ ] Base de datos PostgreSQL creada
- [ ] Backend desplegado (Railway/Render/Fly)
- [ ] Variables de entorno configuradas en backend
- [ ] CORS configurado correctamente
- [ ] Datos seed cargados en base de datos
- [ ] Frontend desplegado en Vercel
- [ ] `NEXT_PUBLIC_API_URL` configurado en Vercel
- [ ] Dominio personalizado configurado (opcional)
- [ ] SSL/HTTPS funcionando
- [ ] Tests de endpoints exitosos
- [ ] Login funcionando con usuario demo

## 🎯 URLs Finales

- **Frontend:** `https://tu-app.vercel.app`
- **Backend API:** `https://tu-backend.railway.app`
- **Swagger Docs:** `https://tu-backend.railway.app/docs`
- **Usuario Demo:** `demo@example.com` (sin password)

## 📞 Soporte

Si encuentras problemas:
1. Revisar logs en Vercel/Railway
2. Verificar variables de entorno
3. Confirmar conectividad de base de datos
4. Revisar configuración de CORS

---

**¡Listo para producción! 🚀**
