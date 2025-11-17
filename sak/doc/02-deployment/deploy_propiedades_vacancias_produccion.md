# Deploy de Propiedades y Vacancias a Producción

**Fecha**: 2025-11-16  
**Autor**: Equipo de Desarrollo  
**Rama**: dev  
**Tipo**: Migración de datos y despliegue de nuevas características

---

## 📋 Resumen de Cambios

### Backend
- Campo `fecha` opcional en endpoint `POST /propiedades/{id}/cambiar-estado`
- Validaciones de fecha contra estado anterior de propiedad y última fecha de vacancia
- Validador Pydantic para parsear fechas ISO string a datetime

### Frontend
- Campo fecha (datetime-local) en popup de cambio de estado
- Validación en tiempo real de fecha mínima
- Refactorización: eliminado código duplicado usando componente `ChangeStateDialog` reutilizable
- Filtros expandidos en dashboard de vacancias (7 opciones)
- Corrección de filtro "activas" para excluir propiedades alquiladas y retiradas

---

## 🔍 Pre-requisitos

1. **Backup de base de datos de producción**
   ```bash
   # Conectarse al servidor de producción
   pg_dump -h <PROD_HOST> -U <PROD_USER> -d <PROD_DB> -F c -b -v -f backup_prod_pre_deploy_$(date +%Y%m%d_%H%M%S).backup
   ```

2. **Verificar acceso a base de datos de desarrollo**
   ```bash
   # Debe poder conectarse para exportar datos validados
   psql -h <DEV_HOST> -U <DEV_USER> -d <DEV_DB> -c "SELECT COUNT(*) FROM propiedades;"
   psql -h <DEV_HOST> -U <DEV_USER> -d <DEV_DB> -c "SELECT COUNT(*) FROM vacancias;"
   ```

3. **Backend y Frontend compilados sin errores**
   - ✅ Backend: 0 errores (verificado)
   - ✅ Frontend: 0 errores (verificado)

---

## 📝 Paso 1: Exportar Datos Validados de Desarrollo

### 1.1 Conectarse a base de datos de desarrollo

```bash
# Variables de entorno (ajustar según tu configuración)
export DEV_HOST="tu-host-desarrollo"
export DEV_USER="tu-usuario-desarrollo"
export DEV_DB="tu-base-desarrollo"
```

### 1.2 Exportar tabla propiedades

```bash
# Exportar solo los datos (INSERT statements)
pg_dump -h $DEV_HOST -U $DEV_USER -d $DEV_DB \
  --table=propiedades \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  -f propiedades_dev_data.sql

echo "✓ Propiedades exportadas a propiedades_dev_data.sql"
```

### 1.3 Exportar tabla vacancias

```bash
# Exportar solo los datos (INSERT statements)
pg_dump -h $DEV_HOST -U $DEV_USER -d $DEV_DB \
  --table=vacancias \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  -f vacancias_dev_data.sql

echo "✓ Vacancias exportadas a vacancias_dev_data.sql"
```

### 1.4 Verificar archivos exportados

```bash
# Verificar que los archivos se crearon correctamente
ls -lh propiedades_dev_data.sql vacancias_dev_data.sql

# Verificar contenido (primeras líneas)
head -n 20 propiedades_dev_data.sql
head -n 20 vacancias_dev_data.sql
```

---

## 🚀 Paso 2: Ejecutar Migraciones en Producción

### 2.1 Conectarse al servidor de producción

```bash
# SSH al servidor de producción
ssh usuario@servidor-produccion

# Navegar al directorio del backend
cd /ruta/al/backend
```

### 2.2 Ejecutar migraciones de Alembic

```bash
# Activar entorno virtual
source venv/bin/activate  # o equivalente en Windows: venv\Scripts\activate

# Verificar estado actual de migraciones
alembic current

# Ejecutar migraciones pendientes
alembic upgrade head

# Verificar que se aplicaron correctamente
alembic current
```

### 2.3 Verificar estructura de tablas

```bash
# Conectarse a la base de datos de producción
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB

# Verificar columna estado_fecha en propiedades
\d propiedades

# Verificar todas las columnas de fecha en vacancias
\d vacancias

# Salir
\q
```

---

## 🗑️ Paso 3: Limpiar Tablas en Producción

### 3.1 Backup de seguridad adicional (solo tablas a limpiar)

```bash
# Backup específico de propiedades y vacancias antes de limpiar
pg_dump -h $PROD_HOST -U $PROD_USER -d $PROD_DB \
  --table=propiedades \
  --table=vacancias \
  -F c -b -v \
  -f backup_propiedades_vacancias_pre_clean_$(date +%Y%m%d_%H%M%S).backup
```

### 3.2 Limpiar tablas en producción

```sql
-- Conectarse a la base de datos de producción
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB

-- Deshabilitar triggers temporalmente para evitar problemas con FKs
SET session_replication_role = 'replica';

-- Limpiar tabla vacancias primero (depende de propiedades)
DELETE FROM vacancias;
SELECT COUNT(*) FROM vacancias; -- Debe retornar 0

-- Limpiar tabla propiedades
DELETE FROM propiedades;
SELECT COUNT(*) FROM propiedades; -- Debe retornar 0

-- Reestablecer triggers
SET session_replication_role = 'origin';

-- Resetear secuencias para que los IDs empiecen desde 1
ALTER SEQUENCE propiedades_id_seq RESTART WITH 1;
ALTER SEQUENCE vacancias_id_seq RESTART WITH 1;

-- Verificar que las secuencias se resetearon
SELECT last_value FROM propiedades_id_seq;  -- Debe ser 1
SELECT last_value FROM vacancias_id_seq;    -- Debe ser 1

-- Salir
\q
```

**⚠️ ADVERTENCIA**: Este paso eliminará TODOS los datos de propiedades y vacancias en producción. Asegúrate de tener el backup.

---

## 📥 Paso 4: Importar Datos Validados de Desarrollo

### 4.1 Copiar archivos SQL al servidor de producción

```bash
# Desde tu máquina local, copiar archivos al servidor
scp propiedades_dev_data.sql usuario@servidor-produccion:/ruta/temporal/
scp vacancias_dev_data.sql usuario@servidor-produccion:/ruta/temporal/
```

### 4.2 Importar propiedades

```bash
# En el servidor de producción
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -f /ruta/temporal/propiedades_dev_data.sql

# Verificar cantidad de registros importados
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "SELECT COUNT(*) FROM propiedades;"
```

### 4.3 Importar vacancias

```bash
# En el servidor de producción
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -f /ruta/temporal/vacancias_dev_data.sql

# Verificar cantidad de registros importados
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "SELECT COUNT(*) FROM vacancias;"
```

### 4.4 Actualizar secuencias después de importación

```sql
-- Conectarse a la base de datos
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB

-- Actualizar secuencia de propiedades al máximo ID + 1
SELECT setval('propiedades_id_seq', (SELECT MAX(id) FROM propiedades));

-- Actualizar secuencia de vacancias al máximo ID + 1
SELECT setval('vacancias_id_seq', (SELECT MAX(id) FROM vacancias));

-- Verificar que las secuencias están correctas
SELECT last_value FROM propiedades_id_seq;
SELECT last_value FROM vacancias_id_seq;

\q
```

---

## ✅ Paso 5: Verificación de Datos Importados

### 5.1 Verificar integridad referencial

```sql
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB

-- Verificar que todas las vacancias tienen propiedad válida
SELECT COUNT(*) as vacancias_huerfanas
FROM vacancias v
LEFT JOIN propiedades p ON v.propiedad_id = p.id
WHERE p.id IS NULL;
-- Debe retornar 0

-- Verificar vacancias activas
SELECT COUNT(*) as vacancias_activas
FROM vacancias
WHERE ciclo_activo = true AND deleted_at IS NULL;

-- Verificar distribución de estados de propiedades
SELECT estado, COUNT(*) as cantidad
FROM propiedades
WHERE deleted_at IS NULL
GROUP BY estado
ORDER BY estado;

-- Verificar que todas las propiedades tienen estado_fecha
SELECT COUNT(*) as sin_estado_fecha
FROM propiedades
WHERE estado_fecha IS NULL AND deleted_at IS NULL;
-- Debe retornar 0 o un número bajo

\q
```

### 5.2 Verificar datos críticos

```sql
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB

-- Listar primeras 5 propiedades con sus vacancias activas
SELECT 
  p.id,
  p.nombre,
  p.propietario,
  p.estado,
  p.estado_fecha,
  COUNT(v.id) as total_vacancias,
  SUM(CASE WHEN v.ciclo_activo THEN 1 ELSE 0 END) as vacancias_activas
FROM propiedades p
LEFT JOIN vacancias v ON p.id = v.propiedad_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.nombre, p.propietario, p.estado, p.estado_fecha
ORDER BY p.id
LIMIT 5;

-- Verificar vacancias con fechas en orden cronológico correcto
SELECT id, propiedad_id,
  fecha_recibida,
  fecha_en_reparacion,
  fecha_disponible,
  fecha_alquilada,
  fecha_retirada
FROM vacancias
WHERE ciclo_activo = true
  AND deleted_at IS NULL
LIMIT 5;

\q
```

---

## 🔄 Paso 6: Desplegar Código del Backend

### 6.1 Actualizar código del backend

```bash
# En el servidor de producción, navegar al directorio del backend
cd /ruta/al/backend

# Hacer pull de la rama dev (o merge a main/master si es tu flujo)
git fetch origin
git checkout dev
git pull origin dev

# Verificar que estás en el commit correcto
git log -1 --oneline
```

### 6.2 Instalar dependencias actualizadas

```bash
# Activar entorno virtual
source venv/bin/activate

# Instalar/actualizar dependencias
pip install -r requirements.txt

# Verificar que no hay errores de importación
python -c "from app.routers.propiedad_router import CambiarEstadoRequest; print('✓ Backend OK')"
```

### 6.3 Reiniciar servidor backend

```bash
# Dependiendo de tu configuración (supervisor, systemd, pm2, etc.)

# Ejemplo con systemd:
sudo systemctl restart backend-api.service
sudo systemctl status backend-api.service

# Ejemplo con supervisor:
supervisorctl restart backend-api
supervisorctl status backend-api

# Ejemplo con uvicorn directo (desarrollo):
# pkill -f uvicorn
# nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

### 6.4 Verificar que el backend está funcionando

```bash
# Verificar endpoint de salud
curl http://localhost:8000/health

# Verificar endpoint de cambiar estado existe
curl http://localhost:8000/docs | grep "cambiar-estado"

# Ver logs en tiempo real
tail -f /var/log/backend/api.log  # Ajustar ruta según tu configuración
```

---

## 🎨 Paso 7: Desplegar Código del Frontend

### 7.1 Build del frontend

```bash
# En tu máquina local o servidor de build
cd /ruta/al/frontend

# Asegurarse de estar en la rama correcta
git checkout dev
git pull origin dev

# Instalar dependencias
npm install

# Verificar variables de entorno de producción
cat .env.production  # Debe tener NEXT_PUBLIC_API_URL correcto

# Build de producción
npm run build

# Verificar que el build fue exitoso
ls -lh .next/
```

### 7.2 Desplegar frontend

#### Opción A: Servidor Next.js (SSR)

```bash
# Copiar build al servidor de producción
rsync -avz --delete .next/ usuario@servidor-produccion:/ruta/al/frontend/.next/
rsync -avz package.json usuario@servidor-produccion:/ruta/al/frontend/
rsync -avz package-lock.json usuario@servidor-produccion:/ruta/al/frontend/

# En el servidor de producción
cd /ruta/al/frontend
npm install --production

# Reiniciar servidor Next.js
sudo systemctl restart frontend-nextjs.service
sudo systemctl status frontend-nextjs.service
```

#### Opción B: Export estático (si aplica)

```bash
# Si usas next export
npm run build
npm run export  # o el comando que uses

# Copiar archivos estáticos al servidor web
rsync -avz --delete out/ usuario@servidor-produccion:/var/www/html/

# Reiniciar servidor web (nginx, apache, etc.)
sudo systemctl restart nginx
```

### 7.3 Verificar frontend en producción

```bash
# Verificar que la aplicación carga
curl https://tu-dominio.com/admin

# Verificar en el navegador
# 1. Abrir https://tu-dominio.com/admin
# 2. Navegar a Propiedades
# 3. Hacer clic en menú de una propiedad → "Cambiar estado"
# 4. Verificar que aparece el campo de fecha
# 5. Intentar seleccionar una fecha anterior al estado actual
# 6. Verificar que muestra error de validación
```

---

## 🧪 Paso 8: Pruebas en Producción

### 8.1 Prueba de cambio de estado con fecha

1. **Acceder al admin en producción**
   - URL: https://tu-dominio.com/admin
   - Navegar a: Propiedades

2. **Seleccionar una propiedad activa**
   - Hacer clic en menú de acciones (⋮)
   - Seleccionar "Cambiar estado"

3. **Verificar campo fecha**
   - ✅ Campo fecha aparece con fecha actual por defecto
   - ✅ Selector de fecha (datetime-local) funciona
   - ✅ Mensaje de "Fecha mínima" se muestra si aplica

4. **Probar validación de fecha**
   - Intentar seleccionar fecha anterior al estado actual
   - ✅ Debe mostrar error en rojo
   - ✅ Botón "Confirmar" debe estar deshabilitado

5. **Probar cambio de estado exitoso**
   - Seleccionar fecha válida (igual o posterior a estado actual)
   - Agregar comentario opcional
   - Hacer clic en "Confirmar"
   - ✅ Debe mostrar mensaje de éxito
   - ✅ Estado debe cambiar en la lista
   - ✅ Fecha debe quedar guardada

### 8.2 Prueba de dashboard de vacancias

1. **Navegar al Dashboard de Vacancias**
   - URL: https://tu-dominio.com/admin#/dashboard-vacancias

2. **Verificar filtros expandidos**
   - ✅ Selector de "Vacancia" tiene 7 opciones:
     - Todos
     - Activas
     - Recibida
     - En reparación
     - Disponible
     - Alquilada
     - Retirada

3. **Verificar filtro "Activas"**
   - Seleccionar filtro "Activas"
   - ✅ NO deben aparecer propiedades en estado "4-alquilada"
   - ✅ NO deben aparecer propiedades en estado "5-retirada"
   - ✅ Solo deben aparecer vacancias realmente activas

4. **Verificar menú de acciones en ranking**
   - Hacer clic en menú (⋮) de una vacancia
   - Seleccionar "Cambiar estado"
   - ✅ Debe abrir el mismo popup con campo fecha
   - ✅ Funcionalidad idéntica a la lista de propiedades

### 8.3 Prueba de validaciones backend

```bash
# Desde terminal o Postman

# Obtener token de autenticación
TOKEN="tu-token-jwt"

# Probar cambio de estado sin fecha (debe usar fecha actual)
curl -X POST "https://tu-dominio.com/api/propiedades/1/cambiar-estado" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nuevo_estado": "2-en_reparacion",
    "comentario": "Prueba sin fecha"
  }'

# Probar cambio de estado con fecha válida
curl -X POST "https://tu-dominio.com/api/propiedades/1/cambiar-estado" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nuevo_estado": "3-disponible",
    "fecha": "2025-11-16T10:00:00",
    "comentario": "Prueba con fecha válida"
  }'

# Probar cambio de estado con fecha inválida (anterior)
curl -X POST "https://tu-dominio.com/api/propiedades/1/cambiar-estado" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nuevo_estado": "3-disponible",
    "fecha": "2020-01-01T10:00:00",
    "comentario": "Prueba con fecha inválida"
  }'
# Debe retornar error 400 con mensaje de validación
```

---

## 📊 Paso 9: Monitoreo Post-Deploy

### 9.1 Verificar logs del backend

```bash
# Ver logs en tiempo real
tail -f /var/log/backend/api.log

# Buscar errores relacionados con cambiar-estado
grep -i "cambiar-estado" /var/log/backend/api.log | tail -20

# Buscar errores de validación de fecha
grep -i "fecha.*anterior" /var/log/backend/api.log | tail -20
```

### 9.2 Verificar métricas de base de datos

```sql
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB

-- Verificar cambios de estado recientes
SELECT 
  id,
  nombre,
  estado,
  estado_fecha,
  estado_comentario,
  updated_at
FROM propiedades
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;

-- Verificar vacancias actualizadas recientemente
SELECT 
  v.id,
  v.propiedad_id,
  p.nombre as propiedad,
  v.fecha_recibida,
  v.fecha_en_reparacion,
  v.fecha_disponible,
  v.fecha_alquilada,
  v.updated_at
FROM vacancias v
JOIN propiedades p ON v.propiedad_id = p.id
WHERE v.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY v.updated_at DESC
LIMIT 10;

\q
```

### 9.3 Verificar performance

```bash
# Verificar tiempo de respuesta del endpoint
time curl -X GET "https://tu-dominio.com/api/propiedades?page=1&perPage=10" \
  -H "Authorization: Bearer $TOKEN"

# Verificar uso de CPU y memoria
top -p $(pgrep -f uvicorn)

# Verificar conexiones a base de datos
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "SELECT count(*) FROM pg_stat_activity WHERE datname='$PROD_DB';"
```

---

## 🔙 Paso 10: Plan de Rollback (En caso de problemas)

### 10.1 Rollback de base de datos

```bash
# Detener backend para evitar escrituras
sudo systemctl stop backend-api.service

# Restaurar backup pre-deploy
pg_restore -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c \
  backup_prod_pre_deploy_YYYYMMDD_HHMMSS.backup

# Verificar que se restauró correctamente
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "SELECT COUNT(*) FROM propiedades;"
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "SELECT COUNT(*) FROM vacancias;"

# Revertir migraciones si es necesario
alembic downgrade -1  # o el revision anterior

# Reiniciar backend con código anterior
git checkout <commit-anterior>
sudo systemctl start backend-api.service
```

### 10.2 Rollback de código

```bash
# Backend
cd /ruta/al/backend
git checkout <commit-anterior>
pip install -r requirements.txt
sudo systemctl restart backend-api.service

# Frontend
cd /ruta/al/frontend
git checkout <commit-anterior>
npm install
npm run build
sudo systemctl restart frontend-nextjs.service  # o el método de deploy que uses
```

---

## 📝 Checklist Final

### Pre-Deploy
- [ ] Backup de base de datos de producción realizado
- [ ] Datos de desarrollo exportados (propiedades_dev_data.sql, vacancias_dev_data.sql)
- [ ] Backend compilado sin errores localmente
- [ ] Frontend compilado sin errores localmente
- [ ] Tests ejecutados exitosamente

### Durante Deploy
- [ ] Migraciones de Alembic ejecutadas en producción
- [ ] Tablas propiedades y vacancias limpiadas
- [ ] Datos de desarrollo importados correctamente
- [ ] Secuencias de PostgreSQL actualizadas
- [ ] Integridad referencial verificada
- [ ] Código del backend actualizado y reiniciado
- [ ] Código del frontend actualizado y reiniciado

### Post-Deploy
- [ ] Endpoint `/propiedades/{id}/cambiar-estado` responde correctamente
- [ ] Campo fecha aparece en popup de cambio de estado
- [ ] Validación de fecha funciona correctamente
- [ ] Filtros expandidos en dashboard funcionan
- [ ] Filtro "activas" excluye alquiladas y retiradas correctamente
- [ ] Logs del backend no muestran errores críticos
- [ ] Performance del sistema es aceptable
- [ ] Usuarios notificados del deploy

---

## 📞 Contactos y Soporte

**En caso de problemas durante el deploy:**

1. **Detener el deploy inmediatamente**
2. **Notificar al equipo técnico**
3. **Evaluar si es necesario rollback**
4. **Documentar el problema y la solución aplicada**

**Equipo de soporte:**
- Backend: [Contacto Backend]
- Frontend: [Contacto Frontend]
- DevOps: [Contacto DevOps]
- DBA: [Contacto DBA]

---

## 📚 Referencias

- Documentación de cambios: `doc/03-devs/20251114-propiedades-vacancia/`
- Código del endpoint: `backend/app/routers/propiedad_router.py`
- Componente ChangeStateDialog: `frontend/src/app/resources/propiedades/components/change-state-dialog.tsx`
- Dashboard de vacancias: `frontend/src/app/resources/dashboard-vacancias/list.tsx`

---

**Fecha de creación**: 2025-11-16  
**Última actualización**: 2025-11-16  
**Versión**: 1.0
