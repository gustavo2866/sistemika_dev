# 🚀 Guía Rápida de Despliegue en Vercel

## ✅ Pre-requisitos Completados

- ✅ Frontend compilado exitosamente (Next.js 15)
- ✅ Backend con todas las dependencias
- ✅ Base de datos PostgreSQL `sak_backend` con datos seed
- ✅ Archivos de configuración creados:
  - `vercel.json`, `.vercelignore` (frontend)
  - `Procfile`, `railway.json`, `Dockerfile` (backend)
  - CORS dinámico configurado

## 📦 Opción 1: Vercel + Railway (Recomendado - GRATIS)

### Paso 1: Crear Base de Datos en Railway (2 min)

1. Ir a [railway.app/new](https://railway.app/new)
2. Login con GitHub
3. Click "Provision PostgreSQL"
4. Copiar la "Postgres Connection URL"
   ```
   postgresql://postgres:...@...railway.app:5432/railway
   ```

### Paso 2: Desplegar Backend en Railway (3 min)

1. En Railway Dashboard → "New Project" → "Deploy from GitHub repo"
2. Seleccionar tu repositorio `sistemika_dev`
3. Configurar:
   - **Root Directory:** `backend`
   - Click "Add Variables"
4. Agregar variables de entorno:
   ```
   DATABASE_URL = [pegar URL de PostgreSQL de arriba]
   CORS_ORIGINS = https://tu-usuario.vercel.app
   ```
5. Click "Deploy"
6. Esperar ~2 minutos
7. Copiar la URL pública (algo como `https://tu-backend.up.railway.app`)

### Paso 3: Inicializar Base de Datos (1 min)

```bash
# Opción A: Con Railway CLI
railway login
railway link [tu-proyecto-id]
railway run python scripts/seed_sak_backend.py

# Opción B: Desde tu computadora (si tienes la URL)
# Editar .env temporal con DATABASE_URL de Railway
python backend/scripts/seed_sak_backend.py
```

### Paso 4: Desplegar Frontend en Vercel (2 min)

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Login con GitHub
3. Click "Import" en tu repositorio
4. Configurar:
   - **Framework Preset:** Next.js ✅ (auto-detectado)
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (default)
5. Click "Environment Variables"
6. Agregar:
   ```
   NEXT_PUBLIC_API_URL = [URL de Railway del Paso 2]
   ```
   Ejemplo: `https://sak-backend-production.up.railway.app`
7. Click "Deploy"
8. Esperar ~3 minutos ☕

### Paso 5: Actualizar CORS (1 min)

1. Volver a Railway Dashboard
2. Click en tu backend service → Variables
3. Actualizar `CORS_ORIGINS` con tu URL de Vercel:
   ```
   CORS_ORIGINS = https://tu-app-git-main-usuario.vercel.app
   ```
4. Railway redeployará automáticamente

### Paso 6: ¡Probar! 🎉

1. Abrir tu URL de Vercel: `https://tu-app.vercel.app`
2. Login con: `demo@example.com`
3. Navegar a recursos: Artículos, Solicitudes, etc.

## 📦 Opción 2: Vercel + Render.com (GRATIS)

### Paso 1: Base de Datos en Render

1. Ir a [dashboard.render.com](https://dashboard.render.com)
2. "New +" → "PostgreSQL"
3. Configurar:
   - Name: `sak-database`
   - Plan: **Free** (limit 256MB)
4. Copiar "Internal Database URL"

### Paso 2: Backend en Render

1. "New +" → "Web Service"
2. Connect tu repositorio GitHub
3. Configurar:
   - **Name:** `sak-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment Variables:
   ```
   DATABASE_URL = [Internal URL del Paso 1]
   CORS_ORIGINS = https://tu-app.vercel.app
   ```
5. Click "Create Web Service"

### Paso 3: Seed Database

```bash
# Desde shell de Render (en Dashboard → Shell)
python scripts/seed_sak_backend.py
```

### Paso 4: Frontend en Vercel

(Igual que Opción 1, Paso 4)

## 📦 Opción 3: Vercel + Fly.io (MÁS CONTROL)

### Requisitos:
```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh
```

### Pasos:

```bash
# 1. Login
fly auth login

# 2. Crear app
cd backend
fly launch --name sak-backend --region iad

# 3. Crear PostgreSQL
fly postgres create --name sak-db --region iad

# 4. Conectar DB al backend
fly postgres attach sak-db --app sak-backend

# 5. Configurar secrets
fly secrets set CORS_ORIGINS="https://tu-app.vercel.app"

# 6. Deploy
fly deploy

# 7. Ejecutar seed
fly ssh console --app sak-backend
python scripts/seed_sak_backend.py
exit
```

Luego frontend en Vercel (Opción 1, Paso 4).

## 🔧 Troubleshooting Común

### ❌ Error: CORS blocked

**Solución:**
```bash
# En Railway/Render Dashboard
# Agregar/actualizar variable:
CORS_ORIGINS = https://tu-app-actual.vercel.app,https://otro-dominio.com
```

### ❌ Error: Cannot connect to database

**Solución:**
1. Verificar que `DATABASE_URL` esté configurada
2. Usar "Internal URL" no "External URL" para Railway/Render
3. Formato correcto: `postgresql+psycopg://user:pass@host:port/db`

### ❌ Error: 404 en llamadas API

**Solución:**
```bash
# En Vercel Dashboard → tu-proyecto → Settings → Environment Variables
# Verificar que NEXT_PUBLIC_API_URL:
# ✅ Correcto: https://backend.railway.app
# ❌ Incorrecto: https://backend.railway.app/
# ❌ Incorrecto: http://backend.railway.app (debe ser https)
```

### ❌ Build failed en Vercel

**Solución:**
1. Verificar Root Directory: `frontend`
2. Ver logs detallados en Vercel Dashboard
3. Compilar localmente: `cd frontend && npm run build`
4. Si funciona local, issue está en variables de entorno

## 📊 Verificar Todo Está Funcionando

```bash
# 1. Backend health
curl https://tu-backend.railway.app/health
# Debe retornar: {"status":"ok"}

# 2. Backend API docs
# Abrir en navegador:
https://tu-backend.railway.app/docs

# 3. Ver artículos
curl https://tu-backend.railway.app/articulos/?limit=5

# 4. Frontend
# Abrir en navegador:
https://tu-app.vercel.app
```

## 🎯 URLs Finales

Después del deploy tendrás:

- **Frontend:** `https://tu-proyecto.vercel.app`
- **Backend:** `https://tu-backend.up.railway.app`
- **Swagger:** `https://tu-backend.up.railway.app/docs`
- **Database:** (Internal en Railway/Render)
- **Login:** `demo@example.com`

## 💰 Costos

**100% GRATIS con:**
- Vercel Free Plan
- Railway Free Plan ($5 crédito/mes)
- Render Free Plan

**Límites:**
- Railway: 500 hrs/mes compute + $5 crédito
- Vercel: 100 GB bandwidth, deployments ilimitados
- Render: 750 hrs/mes

¡Suficiente para desarrollo y producción pequeña! 🚀

## 📚 Más Información

Ver `DEPLOYMENT.md` para guía completa paso a paso.

## 🆘 Ayuda

Si algo no funciona:
1. Revisar logs en Railway/Vercel Dashboard
2. Ejecutar `python check-deploy.py` para verificar configuración
3. Verificar que todas las variables de entorno estén correctas
4. Confirmar que CORS incluye tu dominio de Vercel

---

**¡Listo para desplegar en ~10 minutos! 🎉**
