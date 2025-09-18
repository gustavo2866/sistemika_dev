# Comandos Rápidos - CRUD Genérico

## 🚀 Script de Creación Automática

### Crear Nueva Entidad (Plantilla)

```bash
# 1. Crear estructura de carpetas
mkdir -p app/resources/nueva_entidad
mkdir -p server/app/routers
mkdir -p server/migrations

# 2. Backend - Crear archivos base
touch server/app/models/nueva_entidad.py
touch server/app/routers/nueva_entidad_router.py
touch server/migrations/$(date +%Y%m%d_%H%M%S)_add_nueva_entidad.py

# 3. Frontend - Crear archivos base
touch app/resources/nueva_entidad/index.ts
touch app/resources/nueva_entidad/config.ts
touch app/resources/nueva_entidad/form.tsx
touch app/resources/nueva_entidad/create.tsx
touch app/resources/nueva_entidad/edit.tsx
touch app/resources/nueva_entidad/list.tsx
touch app/resources/nueva_entidad/show.tsx
```

## 🧪 Comandos de Verificación

### Backend
```bash
# Verificar sintaxis Python
cd server
python -m py_compile app/models/nueva_entidad.py
python -m py_compile app/routers/nueva_entidad_router.py

# Ejecutar migración
python migrations/XXX_add_nueva_entidad.py

# Verificar endpoints en Swagger
curl http://127.0.0.1:8000/docs
```

### Frontend
```bash
# Verificar sintaxis TypeScript
cd app_invoice
npx tsc --noEmit

# Verificar compilación Next.js
npm run build

# Ejecutar en desarrollo
npm run dev
```

## 📋 Checklist de Comandos

### Backend Setup
```bash
# 1. Modelo
echo "✅ Crear server/app/models/nueva_entidad.py"
echo "✅ Agregar import en server/app/models/__init__.py"

# 2. Router
echo "✅ Crear server/app/routers/nueva_entidad_router.py"
echo "✅ Agregar import en server/app/routers/__init__.py"
echo "✅ Registrar router en server/app/main.py"

# 3. Base de datos
echo "✅ Crear script de migración"
echo "✅ Ejecutar migración"
```

### Frontend Setup
```bash
# 1. Estructura
echo "✅ Crear carpeta app/resources/nueva_entidad/"
echo "✅ Crear todos los archivos tsx y ts"

# 2. Registro
echo "✅ Agregar exports en app/resources/index.ts"
echo "✅ Registrar Resource en app/admin/AdminApp.tsx"
```

## 🔍 Comandos de Testing

### Verificar Backend
```bash
# Test endpoints básicos
curl -X GET "http://127.0.0.1:8000/nueva-entidades"
curl -X POST "http://127.0.0.1:8000/nueva-entidades" \
  -H "Content-Type: application/json" \
  -d '{"campo1": "test", "user_id": 1}'
```

### Verificar Frontend
```bash
# Acceder a las páginas
echo "Lista: http://localhost:3000/admin/nueva-entidades"
echo "Crear: http://localhost:3000/admin/nueva-entidades/create"
echo "Editar: http://localhost:3000/admin/nueva-entidades/1"
echo "Ver: http://localhost:3000/admin/nueva-entidades/1/show"
```

## 🛠️ Comandos de Debugging

### Backend Issues
```bash
# Ver logs del servidor
cd server
uvicorn app.main:app --reload --log-level debug

# Verificar base de datos
sqlite3 database.db
.tables
.schema nueva_entidad
SELECT * FROM nueva_entidad LIMIT 5;
.exit
```

### Frontend Issues
```bash
# Ver logs detallados
cd app_invoice
npm run dev -- --verbose

# Limpiar cache
rm -rf .next
npm run build
```

## 🚀 Scripts de Automatización

### Script: crear_entidad.sh
```bash
#!/bin/bash
# Uso: ./crear_entidad.sh NombreEntidad

ENTIDAD=$1
TABLA=$(echo $ENTIDAD | tr '[:upper:]' '[:lower:]')
RUTA_PLURAL="${TABLA}s"

echo "🚀 Creando entidad: $ENTIDAD"
echo "📦 Tabla: $TABLA"
echo "🌐 Ruta: /$RUTA_PLURAL"

# Backend
mkdir -p server/app/models
mkdir -p server/app/routers

# Frontend  
mkdir -p app/resources/$TABLA

echo "✅ Estructura creada. Completar manualmente los archivos siguiendo el instructivo."
```

### Script: verificar_crud.sh
```bash
#!/bin/bash
# Verificar que el CRUD esté completo

ENTIDAD=$1
echo "🔍 Verificando CRUD para: $ENTIDAD"

# Backend
echo "📂 Backend:"
ls -la server/app/models/$ENTIDAD.py 2>/dev/null && echo "  ✅ Modelo" || echo "  ❌ Modelo"
ls -la server/app/routers/${ENTIDAD}_router.py 2>/dev/null && echo "  ✅ Router" || echo "  ❌ Router"

# Frontend
echo "📂 Frontend:"
ls -la app/resources/$ENTIDAD/index.ts 2>/dev/null && echo "  ✅ Index" || echo "  ❌ Index"
ls -la app/resources/$ENTIDAD/form.tsx 2>/dev/null && echo "  ✅ Form" || echo "  ❌ Form"
ls -la app/resources/$ENTIDAD/list.tsx 2>/dev/null && echo "  ✅ List" || echo "  ❌ List"
ls -la app/resources/$ENTIDAD/create.tsx 2>/dev/null && echo "  ✅ Create" || echo "  ❌ Create"
ls -la app/resources/$ENTIDAD/edit.tsx 2>/dev/null && echo "  ✅ Edit" || echo "  ❌ Edit"
ls -la app/resources/$ENTIDAD/show.tsx 2>/dev/null && echo "  ✅ Show" || echo "  ❌ Show"
```

## 📊 Monitoreo

### Ver Estado de Endpoints
```bash
# Lista de todos los endpoints disponibles
curl -s http://127.0.0.1:8000/openapi.json | jq '.paths | keys[]'

# Estado de salud
curl http://127.0.0.1:8000/health
```

### Ver Estado Frontend
```bash
# Verificar que la app esté corriendo
curl -s http://localhost:3000/api/health 2>/dev/null && echo "✅ Frontend OK" || echo "❌ Frontend DOWN"
```

---

**Nota**: Ejecutar estos comandos desde la raíz del proyecto SAK para mantener las rutas relativas correctas.
