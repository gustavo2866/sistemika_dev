# 🛠️ Comandos Útiles para Deploy y Mantenimiento

## 📋 Pre-Deploy

```bash
# Verificar que todo esté listo
python check-deploy.py

# Compilar frontend localmente para verificar
cd frontend
npm run build

# Verificar backend localmente
cd backend
python -m pytest
uvicorn app.main:app --reload

# Ver estructura de archivos de deploy
tree -L 2 -I 'node_modules|.next|__pycache__|venv'
```

## 🚀 Deploy Inicial

### Railway (Backend + Database)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto desde GitHub
railway link

# Ver logs en tiempo real
railway logs

# Ejecutar comandos remotos
railway run python scripts/seed_sak_backend.py

# Abrir dashboard
railway open
```

### Vercel (Frontend)

```bash
# Instalar Vercel CLI (opcional)
npm install -g vercel

# Deploy desde CLI
cd frontend
vercel

# Deploy a producción
vercel --prod

# Ver logs
vercel logs

# Ver lista de deployments
vercel ls

# Abrir dashboard
vercel open
```

### Fly.io (Alternativa Backend)

```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Crear y deploy
cd backend
fly launch --name sak-backend

# Deploy manual
fly deploy

# Ver logs
fly logs

# SSH al container
fly ssh console

# Ejecutar comando en container
fly ssh console -C "python scripts/seed_sak_backend.py"

# Escalar (cambiar plan)
fly scale vm shared-cpu-1x --memory 256

# Ver status
fly status
```

## 🗄️ Base de Datos

### Railway PostgreSQL

```bash
# Conectar con psql
railway connect postgres

# O con connection string
psql "postgresql://user:pass@host:port/db"

# Backup
pg_dump -h host -U user -d db > backup.sql

# Restore
psql -h host -U user -d db < backup.sql

# Ver tablas
railway connect postgres
\dt

# Ver datos
SELECT * FROM users;
SELECT * FROM articulos LIMIT 10;
```

### Ejecutar Seed en Producción

```bash
# Opción 1: Railway CLI
railway run python scripts/seed_sak_backend.py

# Opción 2: Render Shell
# En Render Dashboard → tu-servicio → Shell
python scripts/seed_sak_backend.py

# Opción 3: Fly.io
fly ssh console -C "python scripts/seed_sak_backend.py"

# Opción 4: Localmente contra DB remota
# Copiar DATABASE_URL de producción
export DATABASE_URL="postgresql://..."
cd backend
python scripts/seed_sak_backend.py
```

## 🔧 Configuración Variables de Entorno

### Railway

```bash
# Listar variables
railway variables

# Establecer variable
railway variables set CORS_ORIGINS="https://app.vercel.app"

# O desde dashboard:
# railway.app → tu-proyecto → Variables → New Variable
```

### Vercel

```bash
# Ver variables
vercel env ls

# Agregar variable
vercel env add NEXT_PUBLIC_API_URL production

# Desde dashboard:
# vercel.com → tu-proyecto → Settings → Environment Variables
```

### Render

```bash
# Solo desde dashboard:
# dashboard.render.com → tu-servicio → Environment → Add Environment Variable
```

## 📊 Monitoreo

### Ver Logs en Tiempo Real

```bash
# Railway
railway logs --tail

# Vercel
vercel logs --follow

# Fly.io
fly logs
```

### Health Checks

```bash
# Backend health
curl https://tu-backend.railway.app/health

# Ver Swagger docs
open https://tu-backend.railway.app/docs

# Probar endpoint
curl https://tu-backend.railway.app/articulos/?limit=5

# Frontend
curl -I https://tu-app.vercel.app
```

## 🔄 Actualizar Deployment

### Auto-Deploy (Recomendado)

```bash
# Hacer cambios
git add .
git commit -m "Update feature X"
git push origin main

# Railway y Vercel deployarán automáticamente
# Ver progress en dashboards
```

### Deploy Manual

```bash
# Vercel
cd frontend
vercel --prod

# Railway - redeploy desde dashboard
# O forzar con git commit vacío:
git commit --allow-empty -m "Redeploy"
git push origin main

# Fly.io
cd backend
fly deploy
```

## 🐛 Debugging

### Ver Logs Detallados

```bash
# Railway
railway logs --tail 100

# Vercel - último deployment
vercel logs --follow

# Vercel - deployment específico
vercel logs [deployment-url]
```

### Conectar a Base de Datos para Debugging

```bash
# Railway
railway connect postgres

# Verificar datos
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM articulos;
SELECT * FROM solicitudes ORDER BY id DESC LIMIT 5;

# Limpiar datos de prueba
DELETE FROM solicitudes WHERE id > 1;
```

### Reiniciar Servicios

```bash
# Railway - redeploy
railway up --detach

# Fly.io - restart
fly restart

# Vercel - redeploy último commit
vercel --prod
```

## 🔐 Seguridad

### Rotar Secrets

```bash
# Railway
railway variables set DATABASE_URL="new-url"
railway variables set ADMIN_SECRET_KEY="new-key"

# Vercel
vercel env rm NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_API_URL production
```

### Verificar Configuración CORS

```bash
# Test CORS desde frontend domain
curl -X OPTIONS https://backend.railway.app/articulos/ \
  -H "Origin: https://app.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

## 📦 Backups

### Backup Automático Base de Datos

```bash
# Railway - backup manual
pg_dump $(railway variables get DATABASE_URL) > backup-$(date +%Y%m%d).sql

# Backup programado (crear script)
# backup.sh:
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M)
railway connect postgres -- pg_dump > "backup-$DATE.sql"
gzip "backup-$DATE.sql"

# Agregar a crontab
0 2 * * * /path/to/backup.sh
```

### Restore desde Backup

```bash
# Descomprimir
gunzip backup-20250108.sql.gz

# Restore
psql $(railway variables get DATABASE_URL) < backup-20250108.sql
```

## 🧪 Testing en Producción

```bash
# Test API endpoints
# Crear archivo test-prod.sh:

#!/bin/bash
API_URL="https://tu-backend.railway.app"

echo "Testing health..."
curl $API_URL/health

echo "\nTesting users..."
curl $API_URL/users/?limit=5

echo "\nTesting articulos..."
curl $API_URL/articulos/?limit=5

echo "\nTesting solicitudes..."
curl $API_URL/solicitudes/?limit=5

# Ejecutar
chmod +x test-prod.sh
./test-prod.sh
```

## 📈 Escalabilidad

### Railway

```bash
# Ver uso actual
railway status

# Railway escala automáticamente dentro del plan
# Para más recursos, cambiar plan desde dashboard
```

### Fly.io

```bash
# Ver máquinas actuales
fly status

# Escalar verticalmente (más RAM/CPU)
fly scale vm shared-cpu-2x --memory 512

# Escalar horizontalmente (más instancias)
fly scale count 2

# Auto-scale
fly autoscale set min=1 max=3
```

## 🔍 Troubleshooting Común

```bash
# Error: Cannot connect to database
railway connect postgres
# Si falla, verificar DATABASE_URL

# Error: CORS blocked
# Verificar CORS_ORIGINS incluye dominio de Vercel
railway variables get CORS_ORIGINS

# Error: 502 Bad Gateway
# Ver logs para stack trace
railway logs --tail 50

# Build failed en Vercel
# Compilar localmente para reproducir
cd frontend
rm -rf .next node_modules
npm install
npm run build

# Railway deployment stuck
# Forzar redeploy
railway up --detach
```

## 📚 Referencias Rápidas

```bash
# Railway
# Docs: https://docs.railway.app
# Dashboard: https://railway.app/dashboard

# Vercel
# Docs: https://vercel.com/docs
# Dashboard: https://vercel.com/dashboard

# Fly.io
# Docs: https://fly.io/docs
# Dashboard: https://fly.io/dashboard
```

## 🎯 One-Liners Útiles

```bash
# Ver todas las variables de entorno (Railway)
railway variables | grep -v "DATABASE_URL"

# Test rápido de endpoint
curl -s https://backend.railway.app/health | jq

# Ver último deployment en Vercel
vercel ls | head -n 2

# Limpiar cache local
rm -rf frontend/.next frontend/node_modules

# Reinstalar dependencias
cd frontend && npm ci

# Force push (⚠️ cuidado en producción)
git push --force origin main

# Ver diff antes de deploy
git diff origin/main

# Revertir último deployment (Vercel)
# Desde dashboard: Deployments → anterior → Promote to Production
```

---

**💡 Tip:** Guarda estos comandos en un archivo `commands.md` para referencia rápida.
