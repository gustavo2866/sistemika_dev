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
| **ID del Cambio** | `[20251107_bk_solicitudes_req]` |
| **Título** | `[Completar modelo de datos Solicitudes]` |
| **Tipo** | `[ ] Nueva Entidad  [x] Modificar Entidad  [ ] Nuevo Endpoint  [ ] Servicio  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [ ] Alta  [x] Media  [ ] Baja` |
| **Fecha Creación** | `[2025-11-09]` |
| **Autor** | `[Gustasvo]` |
| **Estimación** | `[2]` |
| **Estado** | `[ ] Planificado  [x] En Desarrollo  [ ] Testing  [ ] Completado  [ ] Revertido` |

---

## 1. DESCRIPCIÓN FUNCIONAL

### 1.1 Resumen Ejecutivo

> **Descripción en 2-3 líneas del cambio y su propósito de negocio.**


Se debe completar el modelo de datos de la solicitud de compras para que contemple diferentes casos de uso presentado por el usuario.


### 1.2 Justificación

**¿Por qué se necesita este cambio?**

### 1.2.1 Tipo de solicitud
Necesitamos que los valores posibles para este campo sean parametrizables en el sistema. Hoy solo cuentan con un par de valores fijos (Normal o Directa). Los nuevos valores posibles deben determinar la naturaleza de la compra (Materiales, Servicios, Insumos, Oficina, Socios, etc...). 
El tipo de solicitud determinará el grupo de articulos que estarán disponibles en el detalle. Además un tipo de solicitud podrá tener parametrizado opcionalmente un id de articulo que se podrá tomar como default al crear un nuevo item.
Adicionalmente el tipo de solicitud podrá tener asignado un id de departamento que se tomará como default al crear una nueva solicitud.
El usuario del sistema deberá tener la posibilidad de crear o modificar tipos de solilcitudes, por lo tanto estos valores residirán en una tabla.

### 1.2.2 Departamento 
La solicitud debe tener instanciado el departamente que se encargará de la compra, "Compras, Administración, Cadete, Fletero". Aunque en el frontend se podrá definir un departamente en función del tipo de compra seleccionado el usuario podrá modificar esto , por este motivo el valor debe quedar instanciado en la solicitud.

### 1.2.3 Estado
Las solicitudes debe contar con un campo estado cuyos valores posibles serán (Pendiente, Aprobado, Rechazado, Completado)