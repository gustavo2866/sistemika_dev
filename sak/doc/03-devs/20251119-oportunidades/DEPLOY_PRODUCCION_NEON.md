# Deploy CRM a Producción Neon - Guía Rápida

> **Fecha:** 2025-11-22  
> **Base de datos:** PostgreSQL (Neon)  
> **Ambiente:** Producción  
> **Tiempo estimado:** 15 minutos  

---

## ⚡ Resumen ultra-rápido

```powershell
# 1. Backup selectivo (2min)
cd cmd
.\backup_crm_selective.ps1

# 2. Migrar (2min)
.\mig_prod.ps1

# 3. Seeds (5min)
cd ..\backend
$env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"
python scripts/seed_crm.py
python scripts/seed_propiedades.py
Remove-Item Env:\DATABASE_URL

# 4. Validar (1min)
cd ..\cmd
.\validate_deploy_crm.ps1

# 5. Reiniciar backend (1min)
.\restart_backend.ps1
```

**Listo!** ✅

---

## 📋 Pre-requisitos

- [x] Migración `7ce9174d43c8_20251119_add_crm_core.py` creada
- [x] Scripts `seed_crm.py` y `seed_propiedades.py` validados localmente
- [ ] Backup de producción actualizado
- [ ] Acceso a GCP Secret Manager (`DATABASE_URL`)
- [ ] Backend en rama `dev` con código CRM completo

---

## 🚀 Pasos para Deploy

### **1. Backup de seguridad** (2 min)
```powershell
# Desde cmd/
# Opción 1: Backup selectivo (RECOMENDADO - solo tablas CRM)
.\backup_crm_selective.ps1

# Opción 2: Backup completo (si prefieres respaldar toda la BD)
.\backup_prod.ps1

# Verificar que el backup se creó correctamente
# Archivo selectivo: backups/backup_crm_selective_YYYYMMDD_HHMMSS.sql (~100KB)
# Archivo completo: backups/backup_prod_YYYYMMDD_HHMMSS.sql (~varios MB)
```

**Tablas respaldadas (selectivo):**
- ✅ `propiedades` (estructura + datos - será modificada)
- ✅ Referencias a tablas CRM (serán creadas desde cero)

### **2. Aplicar migraciones** (2 min)
```powershell
# Desde cmd/
.\mig_prod.ps1

# Este script:
# - Obtiene DATABASE_URL de GCP Secret Manager
# - Ejecuta: alembic upgrade head
# - Aplica migración 7ce9174d43c8 (crea todas las tablas CRM)
```

**Tablas creadas:**
- ✅ `crm_tipos_operacion`, `crm_motivos_perdida`, `crm_condiciones_pago`
- ✅ `crm_tipos_evento`, `crm_motivos_evento`, `crm_origenes_lead`
- ✅ `monedas`, `cotizacion_moneda`
- ✅ `emprendimientos`
- ✅ `crm_contactos`, `crm_oportunidades`, `crm_oportunidad_log_estado`, `crm_eventos`
- ✅ Columnas nuevas en `propiedades`: `tipo_operacion_id`, `emprendimiento_id`, `costo_propiedad`, `precio_venta_estimado`, etc.

### **3. Cargar datos iniciales CRM** (3 min)
```powershell
# Desde backend/
cd ..\backend

# Obtener DATABASE_URL de producción
$env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"

# Ejecutar seed CRM (catálogos + datos demo)
python scripts/seed_crm.py

# Limpiar variable
Remove-Item Env:\DATABASE_URL
```

**Datos cargados:**
- 3 tipos de operación (alquiler, venta, emprendimiento)
- 9 motivos de pérdida
- 9 condiciones de pago
- 5 tipos de evento
- 5 motivos de evento
- 5 orígenes de lead
- 3 monedas (ARS, USD, EUR)
- Cotizaciones iniciales
- 2 emprendimientos demo
- 2 contactos demo
- 2 oportunidades demo
- 2 eventos demo

### **4. Completar propiedades existentes** (2 min)
```powershell
# Ejecutar seed de propiedades (completa campos nuevos sin crear registros)
python scripts/seed_propiedades.py

# Este script:
# - Asigna tipo_operacion_id según tipo de propiedad:
#   * Terrenos → tipo_operacion = "emprendimiento" (id=3)
#   * Resto → tipo_operacion = "alquiler" (id=1)
# - Asigna emprendimiento_id SOLO a terrenos
# - Completa costo_propiedad (ARS 1M) si está vacío
# - Completa precio_venta_estimado (USD 150K) si está vacío
# - NO crea propiedades nuevas
```

**Salida esperada:**
```
📊 Procesando 98 propiedades...
  ✅ Propiedad #1 (departamento): tipo_op=alquiler, costo=ARS 1M, precio=USD 150K
  ✅ Propiedad #5 (terreno): tipo_op=emprendimiento, emprendimiento=asignado, costo=ARS 1M
  ...
📋 Resumen:
  • Terrenos → emprendimiento: 12
  • No terrenos → alquiler: 86
  • Total procesadas: 98
✅ Seed completado exitosamente
```

### **5. Reiniciar backend** (1 min)
```powershell
# Desde cmd/
cd ..\cmd
.\restart_backend.ps1

# O si usas deploy automático:
.\deploy_gcp.ps1
```

### **6. Validación post-deploy** (5 min)

#### Opción A: Script automático (RECOMENDADO)
```powershell
# Desde cmd/
.\validate_deploy_crm.ps1

# Este script verifica:
# ✅ Versión de migración aplicada
# ✅ Tablas CRM creadas con datos
# ✅ Propiedades completadas correctamente
# ✅ Terrenos asignados a emprendimientos
```

**Salida esperada:**
```
1️⃣ Verificando versión de migración...
   ✅ Migración CRM aplicada correctamente

2️⃣ Verificando tablas CRM...
📋 Catálogos CRM:
   ✅ crm_tipos_operacion: 3 registros
   ✅ crm_motivos_perdida: 9 registros
   ✅ monedas: 3 registros
   ...
📊 Tablas de datos:
   ✅ crm_contactos: 2
   ✅ crm_oportunidades: 2
🏢 Propiedades completadas:
   ✅ Total propiedades: 98
   ✅ Con tipo_operacion_id: 98/98
   ✅ Terrenos → emprendimiento: 2/2
```

#### Opción B: Validación manual

#### Opción B: Validación manual

##### 6.1 Verificar migraciones aplicadas
```powershell
# Desde backend/
$env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"
alembic current
# Debe mostrar: 7ce9174d43c8 (head)
Remove-Item Env:\DATABASE_URL
```

##### 6.2 Probar endpoints CRM
```bash
# Health check
GET https://api.sak.com/health

# Listar catálogos
GET https://api.sak.com/crm/catalogos/tipos-operacion
GET https://api.sak.com/crm/catalogos/monedas

# Listar contactos
GET https://api.sak.com/crm/contactos

# Listar oportunidades
GET https://api.sak.com/crm/oportunidades

# Crear oportunidad de prueba
POST https://api.sak.com/crm/oportunidades
{
  "contacto_id": 1,
  "tipo_operacion_id": 1,
  "propiedad_id": 1,
  "estado": "1-abierta",
  "responsable_id": 1,
  "descripcion_estado": "Prueba post-deploy"
}
```

##### 6.3 Verificar logs del backend
```powershell
# Si backend en GCP Cloud Run:
gcloud run services logs read sak-backend --project=sak-wcl --limit=50

# Buscar:
# - "CRM endpoints registered" ✅
# - Errores de FK o migraciones ❌
```

---

## ⚠️ Rollback (si algo falla)

### Opción 1: Downgrade de migración
```powershell
cd ..\backend
$env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"
alembic downgrade 2b6cc3ddf3d1
Remove-Item Env:\DATABASE_URL
```

### Opción 2: Restaurar backup selectivo
```powershell
# Desde backend/
$env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"

# Parsear credenciales
$DATABASE_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^\?]+)"
$DB_USER = $matches[1]; $DB_PASS = $matches[2]
$DB_HOST = $matches[3]; $DB_PORT = $matches[4]; $DB_NAME = $matches[5]

# Restaurar backup selectivo
$env:PGPASSWORD = $DB_PASS
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ..\backups\backup_crm_selective_YYYYMMDD_HHMMSS.sql
Remove-Item Env:\PGPASSWORD
Remove-Item Env:\DATABASE_URL
```

### Opción 3: Restaurar backup completo
```powershell
# Desde cmd/
.\restore_prod.ps1 backups/backup_prod_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Checklist de validación

- [ ] Migración `7ce9174d43c8` aplicada (`alembic current`)
- [ ] 7 tablas de catálogos CRM creadas y con datos
- [ ] 4 tablas de datos CRM creadas (contactos, oportunidades, log, eventos)
- [ ] Propiedades existentes con campos CRM completados:
  - [ ] Terrenos con `tipo_operacion_id = 3` (emprendimiento)
  - [ ] Terrenos con `emprendimiento_id` asignado
  - [ ] Resto con `tipo_operacion_id = 1` (alquiler)
  - [ ] Todas con `costo_propiedad` y `precio_venta_estimado`
- [ ] Seed CRM ejecutado (catálogos + datos demo cargados)
- [ ] Backend reiniciado sin errores
- [ ] Endpoints `/crm/*` responden 200
- [ ] Frontend puede listar catálogos y crear oportunidades

---

## 🕐 Tiempo estimado total: **15 minutos**

| Paso | Tiempo |
|------|--------|
| 1. Backup selectivo | 2 min |
| 2. Migraciones | 2 min |
| 3. Seed CRM | 3 min |
| 4. Seed propiedades | 2 min |
| 5. Reinicio backend | 1 min |
| 6. Validación | 5 min |

---

## 📞 Contacto

**En caso de problemas:**
1. Revisar logs del backend (`gcloud run services logs read`)
2. Verificar estado de migraciones (`alembic current`)
3. Consultar errores en `backend/logs/` (si existen)
4. Rollback inmediato si hay datos inconsistentes

---

## 📚 Referencias

- **Spec técnica:** [20251119_oportunidades_spec_backend.md](./20251119_oportunidades_spec_backend.md)
- **Plan de implementación:** [deploy_backend.md](./deploy_backend.md)
- **Script migración:** `backend/alembic/versions/7ce9174d43c8_20251119_add_crm_core.py`
- **Scripts seed:** `backend/scripts/seed_crm.py`, `backend/scripts/seed_propiedades.py`
