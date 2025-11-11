# Troubleshooting - Deploy a Producción

## 🆘 Problemas Comunes y Soluciones

---

## 1. Error en Backup

### Problema: "pg_dump: error: connection to server failed"
```
ERROR: connection to server at "host.neon.tech", port 5432 failed
```

**Causa:** DATABASE_URL_PRODUCTION incorrecta o DB no accesible.

**Solución:**
```powershell
# Verificar variable de entorno
$env:DATABASE_URL_PRODUCTION
# Debe ser: postgresql://user:pass@host:5432/database?sslmode=require

# Probar conexión manualmente
psql $env:DATABASE_URL_PRODUCTION -c "SELECT 1"

# Si falla, verificar:
# 1. IP whitelisting en Neon/Railway
# 2. Credenciales correctas
# 3. Firewall local
```

---

## 2. Error en Migración 0020

### Problema: "relation 'departamentos' already exists"
```
ERROR: relation "departamentos" already exists
```

**Causa:** Migración ya fue aplicada parcialmente.

**Solución:**
```powershell
# Verificar estado de migraciones
alembic current

# Si muestra 0020 pero tabla no existe, forzar estado
alembic stamp 0019  # Volver a estado anterior
alembic upgrade +1  # Aplicar 0020 nuevamente

# O eliminar tabla y volver a crear
psql $env:DATABASE_URL_PRODUCTION -c "DROP TABLE IF EXISTS departamentos CASCADE"
alembic upgrade +1
```

---

## 3. Error en Migración 0021

### Problema: "foreign key constraint 'tipos_solicitud_articulo_default_id_fkey' violates constraint"
```
ERROR: insert or update on table "tipos_solicitud" violates foreign key constraint
```

**Causa:** `articulo_default_id` referencia a un artículo que no existe.

**Solución:**
```powershell
# Verificar artículos en DB
psql $env:DATABASE_URL_PRODUCTION -c "SELECT id, nombre FROM articulos LIMIT 5"

# Editar seed para usar IDs válidos
code backend\scripts\seed_tipos_solicitud.py

# Ajustar líneas:
# articulo_default_id=None,  # O un ID válido
```

---

## 4. Error en Migración 0022 (CRÍTICO)

### Problema A: "column 'tipo' does not exist"
```
ERROR: column solicitudes.tipo does not exist
```

**Causa:** Columna `tipo` ya fue eliminada en una ejecución anterior fallida.

**Solución:**
```powershell
# Verificar columnas actuales
psql $env:DATABASE_URL_PRODUCTION -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'solicitudes'"

# Si NO existe 'tipo' pero SÍ existen nuevas columnas, marcar migración como completa
alembic stamp 0022

# Si NO existen nuevas columnas, restaurar desde backup y reintentar
psql $env:DATABASE_URL_PRODUCTION -f "backend\backups\backup_prod_YYYYMMDD_HHmmss.sql"
alembic upgrade +1
```

### Problema B: "solicitudes sin tipo_solicitud_id después de migración"
```
Solicitudes inválidas: 15
```

**Causa:** Algunas solicitudes no se pudieron mapear a un tipo.

**Solución:**
```powershell
# Identificar solicitudes problemáticas
psql $env:DATABASE_URL_PRODUCTION -c "SELECT id, tipo_solicitud_id, departamento_id FROM solicitudes WHERE tipo_solicitud_id IS NULL OR departamento_id IS NULL"

# Asignar tipo manualmente (primer tipo disponible)
psql $env:DATABASE_URL_PRODUCTION -c "UPDATE solicitudes SET tipo_solicitud_id = (SELECT id FROM tipos_solicitud ORDER BY id LIMIT 1) WHERE tipo_solicitud_id IS NULL"

# Asignar departamento "Compras"
psql $env:DATABASE_URL_PRODUCTION -c "UPDATE solicitudes SET departamento_id = (SELECT id FROM departamentos WHERE nombre = 'Compras') WHERE departamento_id IS NULL"
```

### Problema C: "Número de solicitudes cambió"
```
ERROR: Número de solicitudes cambió! Antes: 150, Después: 145
```

**Causa:** Migración eliminó solicitudes (bug grave).

**Solución:**
```powershell
# ROLLBACK INMEDIATO
alembic downgrade -1

# Restaurar desde backup
psql $env:DATABASE_URL_PRODUCTION -f "backend\backups\backup_prod_YYYYMMDD_HHmmss.sql"

# Investigar causa antes de reintentar
# Revisar migración 0022 en: backend\alembic\versions\0022_*.py
```

---

## 5. Error en Deploy de Backend

### Problema: "Build failed on Railway/Fly.io"
```
ERROR: ModuleNotFoundError: No module named 'app.models.departamento'
```

**Causa:** Imports no actualizados en `__init__.py`.

**Solución:**
```powershell
# Verificar exports en backend\app\models\__init__.py
code backend\app\models\__init__.py

# Debe incluir:
# from .departamento import Departamento, DepartamentoCreate, DepartamentoUpdate, DepartamentoRead
# from .tipo_solicitud import TipoSolicitud, TipoSolicitudCreate, TipoSolicitudUpdate, TipoSolicitudRead

# Commit y push
git add backend\app\models\__init__.py
git commit -m "fix: add missing imports"
git push origin master
```

### Problema: "Server error 500 al acceder a /solicitudes"
```
HTTP 500 Internal Server Error
```

**Causa:** Falta enum `EstadoSolicitud` o imports incorrectos.

**Solución:**
```powershell
# Ver logs de backend
railway logs --tail 100
# O: fly logs

# Buscar error específico
# Si dice "NameError: name 'EstadoSolicitud' is not defined"

# Verificar que enum existe en backend\app\models\solicitud.py
code backend\app\models\solicitud.py

# Debe tener:
# from enum import Enum
# class EstadoSolicitud(str, Enum):
#     PENDIENTE = "pendiente"
#     APROBADA = "aprobada"
#     ...

# Commit y push fix
git add .
git commit -m "fix: add EstadoSolicitud enum"
git push origin master
```

---

## 6. Error en Deploy de Frontend

### Problema: "Build failed on Vercel"
```
Error: Module not found: Can't resolve '@/components/forms/form-field'
```

**Causa:** Imports de componentes nuevos no existen.

**Solución:**
```powershell
cd frontend

# Verificar que componente existe
ls src\components\forms\form-field.tsx

# Si no existe, crear stub básico
# O remover import si no es necesario

# Build local para validar
npm run build

# Push cuando build local sea exitoso
git add .
git commit -m "fix: resolve missing imports"
git push origin master
```

### Problema: "Frontend muestra error 'tipo_solicitud_id' undefined"
```
TypeError: Cannot read property 'tipo_solicitud_id' of undefined
```

**Causa:** Frontend intenta acceder a campos que no existen en solicitudes antiguas.

**Solución:**
```typescript
// En frontend\src\app\resources\solicitudes\form.tsx
// Usar optional chaining

const tipoSolicitudId = solicitud?.tipo_solicitud_id ?? null;
const departamentoId = solicitud?.departamento_id ?? null;
const estado = solicitud?.estado ?? 'pendiente';
const total = solicitud?.total ?? 0;

// O asignar defaults en caso de undefined
useEffect(() => {
  if (solicitud) {
    setValue('tipo_solicitud_id', solicitud.tipo_solicitud_id || 1);
    setValue('departamento_id', solicitud.departamento_id || 1);
    setValue('estado', solicitud.estado || 'pendiente');
    setValue('total', solicitud.total || 0);
  }
}, [solicitud]);
```

---

## 7. Datos Inconsistentes Post-Deploy

### Problema: "Solicitudes antiguas sin tipo/departamento en frontend"
```
GET /solicitudes/{id} retorna:
{
  "tipo_solicitud_id": null,
  "departamento_id": null
}
```

**Causa:** Migración 0022 no asignó tipo/departamento a esa solicitud específica.

**Solución:**
```powershell
# Identificar solicitudes problemáticas
psql $env:DATABASE_URL_PRODUCTION -c "SELECT id FROM solicitudes WHERE tipo_solicitud_id IS NULL OR departamento_id IS NULL"

# Asignar defaults
psql $env:DATABASE_URL_PRODUCTION -c @"
UPDATE solicitudes 
SET 
  tipo_solicitud_id = COALESCE(tipo_solicitud_id, (SELECT id FROM tipos_solicitud ORDER BY id LIMIT 1)),
  departamento_id = COALESCE(departamento_id, (SELECT id FROM departamentos WHERE nombre = 'Compras'))
WHERE tipo_solicitud_id IS NULL OR departamento_id IS NULL
"@
```

---

## 8. Performance Issues

### Problema: "API muy lenta después del deploy"
```
GET /solicitudes tarda 10+ segundos
```

**Causa:** Falta índice en nuevas columnas o JOIN ineficiente.

**Solución:**
```powershell
# Crear índices
psql $env:DATABASE_URL_PRODUCTION -c @"
CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo_solicitud_id ON solicitudes(tipo_solicitud_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_departamento_id ON solicitudes(departamento_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
"@

# Verificar plan de ejecución
psql $env:DATABASE_URL_PRODUCTION -c "EXPLAIN ANALYZE SELECT * FROM solicitudes LIMIT 100"

# Si sigue lento, verificar estadísticas de tabla
psql $env:DATABASE_URL_PRODUCTION -c "ANALYZE solicitudes"
```

---

## 9. Rollback Completo

### Cuándo hacer rollback:
- ✅ Datos corruptos o inconsistentes
- ✅ Pérdida de solicitudes
- ✅ API no funcional después de 30 minutos
- ✅ Múltiples errores 500/400 no resueltos

### Proceso de Rollback:

**1. Rollback de Frontend (2 min):**
```powershell
vercel rollback https://tu-frontend-production.vercel.app
```

**2. Rollback de Backend - Código (5 min):**
```powershell
git checkout master
git revert HEAD
git push origin master
```

**3. Rollback de Migraciones (15 min):**
```powershell
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION

# Revertir 0022
alembic downgrade -1

# Revertir 0021
alembic downgrade -1

# Revertir 0020
alembic downgrade -1

# Verificar estado
alembic current
# Debe mostrar: 0019 o anterior
```

**4. Restauración desde Backup (si rollback de migraciones falla):**
```powershell
# Descomprimir backup
Expand-Archive -Path "backend\backups\backup_prod_YYYYMMDD_HHmmss.zip" -DestinationPath "backend\backups\temp"

# ⚠️ ESTO BORRARÁ TODOS LOS DATOS NUEVOS
psql $env:DATABASE_URL_PRODUCTION -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql $env:DATABASE_URL_PRODUCTION -f "backend\backups\temp\backup_prod_YYYYMMDD_HHmmss.sql"

# Verificar datos restaurados
psql $env:DATABASE_URL_PRODUCTION -c "SELECT COUNT(*) FROM solicitudes"
```

**5. Comunicar a Stakeholders:**
```text
Asunto: Rollback de Deploy - Solicitudes Refactor

Se ha realizado un rollback del deploy debido a [razón específica].

Estado actual:
- Frontend: Versión anterior restaurada
- Backend: Versión anterior restaurada
- Base de datos: Restaurada desde backup de [fecha/hora]

Datos perdidos:
- Solicitudes creadas después de [hora del backup]: X registros
- Modificaciones entre [hora backup] y [hora rollback]: X registros

Próximos pasos:
1. Investigar causa raíz del problema
2. Implementar fix en ambiente local
3. Re-probar exhaustivamente
4. Agendar nuevo deploy

Disculpas por las molestias.
```

---

## 10. Verificación Post-Rollback

```powershell
# Verificar que todo volvió a la normalidad

# 1. Frontend funciona
start https://tu-frontend-production.vercel.app
# Debe mostrar versión anterior (sin tipo/departamento en solicitudes)

# 2. Backend responde
curl https://tu-backend-production.com/docs
# No debe mostrar endpoints /departamentos ni /tipos-solicitud

# 3. Datos intactos
psql $env:DATABASE_URL_PRODUCTION -c "SELECT COUNT(*) FROM solicitudes"
# Debe coincidir con el conteo del backup

# 4. Migraciones en estado correcto
alembic current
# Debe mostrar migración anterior a 0020

# 5. Tabla solicitudes con columna 'tipo' antigua
psql $env:DATABASE_URL_PRODUCTION -c "SELECT tipo FROM solicitudes LIMIT 1"
# Debe retornar 'normal' o 'directa'
```

---

## 📞 Contactos de Emergencia

| Situación | Contacto | Acción |
|-----------|----------|--------|
| DB corrupta | DBA | Restaurar desde backup externo |
| Backend caído | DevOps | Revisar logs de servidor |
| Frontend caído | Vercel Support | Ticket de soporte |
| Datos perdidos | Dev Lead | Evaluar recuperación |

---

## 📝 Lecciones Aprendidas (Llenar post-deploy)

**Fecha del incidente:** __________  
**Problema:** ______________________________________  
**Causa raíz:** ____________________________________  
**Tiempo de resolución:** ______ minutos  
**Acciones tomadas:** _______________________________  
**Prevención futura:** _______________________________

---

## ✅ Checklist de Validación Pre-Deploy

Usar este checklist ANTES de hacer deploy para evitar problemas:

### Base de Datos
- [ ] Backup verificado (tamaño > 0, descomprime OK)
- [ ] Backup en 2+ ubicaciones
- [ ] Script de restore probado en local
- [ ] DATABASE_URL_PRODUCTION accesible

### Código
- [ ] Todos los tests pasan: `pytest -v`
- [ ] Build de frontend exitoso: `npm run build`
- [ ] Sin errores de linting
- [ ] Code review completado

### Migraciones
- [ ] Migraciones probadas en local con datos de producción (copia)
- [ ] Downgrade funciona correctamente
- [ ] Seeds idempotentes (no duplican datos)
- [ ] Estimado de tiempo de cada migración: < 5 min

### Frontend
- [ ] E2E probado contra backend local con nuevos endpoints
- [ ] Optional chaining en campos nuevos
- [ ] Manejo de solicitudes legacy (sin tipo/dept)
- [ ] Variables de entorno correctas

### Organización
- [ ] Stakeholders notificados
- [ ] Ventana de mantenimiento (si aplica)
- [ ] Equipo disponible para monitorear
- [ ] Plan de comunicación listo

---

**Última actualización:** 2025-11-10  
**Mantenido por:** Gustavo Palmieri
