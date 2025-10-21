# Guía de Deploy en Render

## 📦 Deploy del Backend SAK en Render

### Paso 1: Preparar el repositorio

1. Asegúrate de que todos los cambios estén commiteados:
```bash
git add .
git commit -m "feat: Preparar backend para deploy en Render"
git push origin v1
```

### Paso 2: Crear cuenta en Render

1. Ve a https://render.com
2. Regístrate con tu cuenta de GitHub
3. Autoriza a Render para acceder a tus repositorios

### Paso 3: Crear Base de Datos PostgreSQL

1. En el dashboard de Render, haz clic en **"New +"**
2. Selecciona **"PostgreSQL"**
3. Configura:
   - **Name**: `sak-db`
   - **Database**: `sak_backend`
   - **User**: `sak_user`
   - **Region**: Oregon (o el más cercano a ti)
   - **Plan**: Free
4. Haz clic en **"Create Database"**
5. **IMPORTANTE**: Copia la **Internal Database URL** (la necesitarás)

### Paso 4: Crear Web Service

1. En el dashboard, haz clic en **"New +"**
2. Selecciona **"Web Service"**
3. Conecta tu repositorio de GitHub: `gustavo2866/sistemika_dev`
4. Configura:
   - **Name**: `sak-backend`
   - **Region**: Oregon (mismo que la DB)
   - **Branch**: `v1`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `bash start.sh`
   - **Plan**: Free

### Paso 5: Configurar Variables de Entorno

En la sección **"Environment Variables"**, agrega:

```
DATABASE_URL = [La Internal Database URL que copiaste del paso 3]
CLOUDINARY_CLOUD_NAME = do97luh2t
CLOUDINARY_API_KEY = 883736772274724
CLOUDINARY_API_SECRET = Y5Ggz-KdAwg2QRrEe-0kX22jFZg
OPENAI_API_KEY = [Tu API key de OpenAI]
CORS_ORIGINS = http://localhost:3000
```

**Nota**: Actualizarás `CORS_ORIGINS` después con la URL de Vercel

### Paso 6: Deploy

1. Haz clic en **"Create Web Service"**
2. Render comenzará a:
   - Clonar tu repositorio
   - Instalar dependencias
   - Ejecutar migraciones
   - Iniciar el servidor
3. El proceso toma 3-5 minutos

### Paso 7: Verificar

1. Una vez completado, obtendrás una URL como: `https://sak-backend.onrender.com`
2. Prueba: `https://sak-backend.onrender.com/health`
3. Deberías ver: `{"status":"ok"}`

### Paso 8: Ejecutar seed data (opcional)

Si necesitas cargar datos iniciales:

1. Ve a tu servicio en Render
2. En la pestaña **"Shell"**, ejecuta:
```bash
python -c "from app.db import init_db; init_db()"
python scripts/seed_data.py  # Si tienes este script
```

## 🎯 Resultado

Backend desplegado en: `https://sak-backend.onrender.com`

## ⚠️ Notas Importantes

- **Plan Free**: El servicio se "duerme" después de 15 minutos de inactividad
- **Primera request**: Puede tomar 30-60 segundos en "despertar"
- **Límites**: 750 horas/mes gratis (suficiente para desarrollo)
- **Database**: 256MB en plan free (suficiente para desarrollo)

## 🔄 Actualizar después del deploy

Cuando hagas cambios:
```bash
git add .
git commit -m "tu mensaje"
git push origin v1
```

Render detectará el push y redesplegará automáticamente.

## 🐛 Troubleshooting

- **Ver logs**: En Render dashboard → Tu servicio → Logs
- **Shell access**: En Render dashboard → Tu servicio → Shell
- **Revisar env vars**: Environment → Environment Variables
