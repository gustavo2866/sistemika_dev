# 📚 Documentación Completa - Solicitudes Refactor

Este directorio contiene toda la documentación para el refactor del módulo de Solicitudes.

---

## 📑 Índice de Documentos

### 1. **20251107_bk_solicitudes_req.md**
📋 **Tipo:** Requerimientos  
🎯 **Propósito:** Documento original con requerimientos funcionales del refactor  
👥 **Audiencia:** Product Owner, Stakeholders, Developers  
📊 **Estado:** ✅ Aprobado

**Contenido:**
- Descripción del problema actual
- Requerimientos funcionales
- Historias de usuario
- Reglas de negocio

**Cuándo usar:** Para entender el "QUÉ" y "POR QUÉ" del refactor.

---

### 2. **20251107_bk_solicitudes_spec.md**
📐 **Tipo:** Especificación Técnica  
🎯 **Propósito:** Documento técnico detallado con todos los cambios de implementación  
👥 **Audiencia:** Developers, Technical Lead  
📊 **Estado:** ✅ Aprobado y listo para implementación

**Contenido:**
- Resumen ejecutivo
- Modelos de datos (Departamento, TipoSolicitud, Solicitud modificado)
- 3 migraciones Alembic con código completo
- Scripts de seed
- Especificación de endpoints (todos genéricos)
- 20+ casos de prueba
- 11 consultas técnicas (TODAS RESUELTAS ✅)
- Métricas y fases de implementación
- Breaking changes

**Cuándo usar:** Para implementar cada componente del refactor. Es la "biblia" técnica.

---

### 3. **IMPLEMENTATION_GUIDE.md**
🛠️ **Tipo:** Guía de Implementación  
🎯 **Propósito:** Guía paso a paso para implementar el refactor en entorno LOCAL  
👥 **Audiencia:** Developer implementando el refactor  
📊 **Estado:** 📖 Guía de referencia

**Contenido:**
- 5 fases de implementación (Models, Migrations, CRUD/Routers, Testing, Verificación)
- Comandos PowerShell específicos
- Checkpoints de validación en cada paso
- Scripts de backup y restore
- Plan de rollback para local
- Deploy a producción (9 pasos detallados)
- Timings estimados (8 horas total)

**Cuándo usar:** Durante la implementación en local. Seguir fase por fase con checkpoints.

---

### 4. **DEPLOY_PRODUCTION_CHECKLIST.md**
✅ **Tipo:** Checklist Operacional  
🎯 **Propósito:** Lista imprimible para ejecutar deploy a producción  
👥 **Audiencia:** Developer/DevOps ejecutando el deploy  
📊 **Estado:** 🖨️ Lista de verificación

**Contenido:**
- Pre-requisitos obligatorios
- 8 pasos con tiempos y comandos exactos
- Espacios para anotar tiempos y resultados
- Verificaciones post-deploy
- Rollback rápido
- Contactos de emergencia

**Cuándo usar:** Imprimir y tener a mano durante el deploy a producción. Marcar cada checkbox.

---

### 5. **TROUBLESHOOTING_PRODUCTION.md**
🆘 **Tipo:** Guía de Resolución de Problemas  
🎯 **Propósito:** Soluciones a problemas comunes durante el deploy  
👥 **Audiencia:** Developer/DevOps resolviendo incidentes  
📊 **Estado:** 🚨 Referencia de emergencia

**Contenido:**
- 10 problemas comunes con soluciones
- Errores de backup, migraciones, deploy
- Datos inconsistentes
- Performance issues
- Proceso completo de rollback
- Verificación post-rollback
- Template para documentar incidentes

**Cuándo usar:** Cuando algo sale mal durante el deploy. Buscar el problema específico.

---

## 🚀 Scripts Automatizados

### **deploy-production.ps1** (en raíz del proyecto)
🤖 **Tipo:** Script PowerShell  
🎯 **Propósito:** Automatizar pasos del deploy a producción  
⚙️ **Uso:**
```powershell
# Deploy completo
.\deploy-production.ps1

# Dry run (simular sin ejecutar)
.\deploy-production.ps1 -DryRun

# Saltar backup (no recomendado)
.\deploy-production.ps1 -SkipBackup

# Saltar merge (si ya está hecho)
.\deploy-production.ps1 -SkipMerge
```

**Qué hace:**
1. Crea backup automático de DB de producción
2. Merge de branch a master
3. Aplica 3 migraciones secuencialmente
4. Ejecuta seeds
5. Verifica integridad de datos
6. Muestra resumen final

**Cuándo usar:** Para automatizar el deploy y reducir errores manuales.

---

## 📖 Cómo Usar Esta Documentación

### Fase 1: **Entender el Proyecto**
1. Leer `20251107_bk_solicitudes_req.md` → Entender requerimientos
2. Leer `20251107_bk_solicitudes_spec.md` → Entender solución técnica

### Fase 2: **Implementar en Local**
1. Abrir `IMPLEMENTATION_GUIDE.md`
2. Seguir **Paso 1: Pre-requisitos**
3. Seguir **Paso 2: Backup**
4. Implementar **Fases 1-5** secuencialmente
5. Marcar checkpoints ✅ conforme avanzas

### Fase 3: **Probar con Frontend**
1. Ejecutar backend local con nuevos cambios
2. Probar frontend contra backend local
3. Hacer pruebas E2E completas
4. Documentar cualquier ajuste necesario

### Fase 4: **Deploy a Producción**
1. **Imprimir** `DEPLOY_PRODUCTION_CHECKLIST.md`
2. Verificar **Pre-requisitos** completos
3. Ejecutar script `.\deploy-production.ps1` (recomendado)
   - O seguir checklist manualmente paso por paso
4. Marcar cada checkbox conforme completas
5. Guardar checklist completado como registro

### Fase 5: **Si Algo Sale Mal**
1. Abrir `TROUBLESHOOTING_PRODUCTION.md`
2. Buscar el problema específico
3. Seguir solución propuesta
4. Si no está documentado, ejecutar rollback (Sección 9)
5. Documentar el problema nuevo para futuras referencias

---

## ⏱️ Tiempos Estimados

| Fase | Local | Producción |
|------|-------|------------|
| Pre-requisitos | 30 min | 15 min |
| Models | 1.5 horas | - |
| Migrations | 2 horas | 30 min |
| CRUD/Routers | 2 horas | - |
| Testing | 2 horas | - |
| Verificación | 30 min | 20 min |
| Deploy Backend | - | 10 min |
| Deploy Frontend | - | 15 min |
| **TOTAL** | **~8 horas** | **~90 min** |

---

## 🎯 Decisiones Clave (Resumen)

| Decisión | Resultado |
|----------|-----------|
| **Código/Orden** | ❌ NO incluir en TipoSolicitud |
| **Tipos Normal/Directa** | ❌ NO crear en seed (solo para migración) |
| **Endpoints custom** | ❌ Usar solo CRUD genérico |
| **Cambio de estado** | ✅ Via PUT genérico |
| **Cálculo de total** | ✅ Frontend calcula y envía |
| **Validaciones de estado** | ❌ NO en backend |
| **Defaults** | ✅ Frontend maneja |
| **Mapeo de legacy** | ✅ Todo a departamento "Compras" |
| **URL naming** | ✅ Kebab-case (/tipos-solicitud) |

---

## 📊 Métricas del Proyecto

### Entregables
- 📄 5 documentos (req, spec, guía, checklist, troubleshooting)
- 🤖 1 script automatizado
- 🗄️ 2 modelos nuevos (Departamento, TipoSolicitud)
- 🔄 3 migraciones Alembic
- 📝 2 scripts de seed
- 🧪 20+ test cases
- 🛣️ 15 endpoints (5 por recurso, todos genéricos)

### Complejidad
- **Riesgo:** 🔴 Alto (modifica tabla existente)
- **Impacto:** 🔴 Alto (breaking change para frontend)
- **Reversibilidad:** 🟡 Moderada (rollback complejo, backup crítico)

### Dependencias
- ✅ Backend debe implementarse primero
- ✅ Frontend debe adaptarse antes de deploy a producción
- ⚠️ Deploy coordinado backend + frontend necesario

---

## 🔗 Referencias Adicionales

### Patrones de Backend
- `doc/03-devs/README_BACKEND_PATTERNS.md` → Patrones generales del backend
  - Base models
  - GenericCRUD
  - NestedCRUD
  - Router factory
  - Naming conventions

### Documentación de Proyecto
- `README.md` → Setup general del proyecto
- `COMMANDS.md` → Comandos frecuentes
- `backend/README.md` → Setup de backend
- `frontend/README.md` → Setup de frontend

---

## 📞 Soporte y Contacto

| Rol | Responsable | Contacto |
|-----|-------------|----------|
| **Dev Lead** | Gustavo Palmieri | [email/teléfono] |
| **Product Owner** | [Nombre] | [email/teléfono] |
| **DevOps** | [Nombre] | [email/teléfono] |
| **DBA** | [Nombre] | [email/teléfono] |

---

## 🆕 Historial de Versiones

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2025-11-10 | 1.0 | Documentación inicial completa |
| 2025-11-10 | 1.1 | Agregado script automatizado de deploy |
| 2025-11-10 | 1.2 | Agregado troubleshooting y checklist |

---

## ✅ Estado Actual del Proyecto

```
┌─────────────────────────────────────────────────────┐
│  📊 ESTADO: READY FOR IMPLEMENTATION                │
├─────────────────────────────────────────────────────┤
│  ✅ Requerimientos aprobados                        │
│  ✅ Spec técnico completo (0 consultas pendientes)  │
│  ✅ Guías de implementación documentadas            │
│  ✅ Scripts de automatización creados               │
│  ✅ Troubleshooting documentado                     │
│  📝 Implementación en local: PENDIENTE              │
│  📝 Testing E2E: PENDIENTE                          │
│  📝 Deploy a producción: PENDIENTE                  │
└─────────────────────────────────────────────────────┘
```

**Próximo paso:** Comenzar implementación en local siguiendo `IMPLEMENTATION_GUIDE.md`

---

**Última actualización:** 2025-11-10  
**Mantenido por:** Gustavo Palmieri  
**Versión:** 1.2
