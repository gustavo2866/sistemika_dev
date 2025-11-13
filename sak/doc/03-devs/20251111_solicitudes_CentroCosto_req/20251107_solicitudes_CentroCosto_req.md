# 📝 Requerimientos - Completar Modelo Solicitudes

> **Referencia:** [README_BACKEND_PATTERNS.md](../README_BACKEND_PATTERNS_v1.md)  

> **Versión:** 1.0

---

## ⚠️ INSTRUCCIONES DE USO

1. **Copiar este template** para cada cambio significativo al backend
2. **Nombrar el archivo**: `SPEC_{fecha}_{feature}.md` (ej: `SPEC_20251110_agregar_campo_prioridad.md`)
3. **Completar todas las secciones** antes de comenzar desarrollo
4. **Revisar checklist** antes de considerar el cambio completo
5. **Consultar README_BACKEND_v1.md** para mantener patrones y convenciones

---

## 📋 METADATA DEL CAMBIO

| Campo | Valor |
|-------|-------|
| **ID del Cambio** | `[20251111_solicitudes_centrocosto_req]` |
| **Título** | `[Agregar centro costo] y precio` |
| **Tipo** | `[ ] Nueva Entidad  [x] Modificar Entidad  [ ] Nuevo Endpoint  [ ] Servicio  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [ ] Alta  [x] Media  [ ] Baja` |
| **Fecha Creación** | `[2025-11-09]` |
| **Autor** | `[Gustavo]` |
| **Estimación** | `[2]` |
| **Estado** | `[ ] Planificado  [x] En Desarrollo  [ ] Testing  [ ] Completado  [ ] Revertido` |

---

## 1. DESCRIPCIÓN FUNCIONAL

### 1.1 Resumen Ejecutivo

> **Descripción en 2-3 líneas del cambio y su propósito de negocio.**


Se debe completar el modelo de datos de la solicitud de compras para que contemple centro de costo y precio.


### 1.2 Justificación

**¿Por qué se necesita este cambio?**

### 1.2.1 Centro de Costo
Necesitamos que las solicitudes tengan asignado un centro de costo. Los valores posibles para este campo deben ser parametrizables en el sistema.  
Los centros de costo además deben contar con un tipo [Proyecto, Propiedad, Socios, General] y un string contable.
En la carga inicial de los centros de costos crear un centro de costo por cada propiedad, por cada proyecto y se debe inventar 4 centros de costos generales.
En la migración se debe asignar a todas las solicitudes el id de centro de costo 1.

### 1.2.2 Precio e Importe
Cada uno de los items de la solicitud debe contar con los campos Precio e Importe.
En la migración asignar el valor cero a todos los registros.
