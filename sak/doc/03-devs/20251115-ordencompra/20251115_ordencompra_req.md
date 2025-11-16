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
| **Título** | `[Agregar entidad vacancia` |
| **Tipo** | `[x] Nueva Entidad  [x] Modificar Entidad  [ ] Nuevo Endpoint  [ ] Servicio  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [ ] Alta  [x] Media  [ ] Baja` |
| **Fecha Creación** | `[2025-11-14]` |
| **Autor** | `[Gustavo]` |
| **Estimación** | `[2]` |
| **Estado** | `[ ] Planificado  [x] En Desarrollo  [ ] Testing  [ ] Completado  [ ] Revertido` |

---

## 1. DESCRIPCIÓN FUNCIONAL

### 1.1 Resumen Ejecutivo

> **Descripción en 2-3 líneas del cambio y su propósito de negocio.**

Se necesita implementar la entidad Orden de Compra para hacer un seguimiento completo de las compras de la empresa.  

Registración: 
==============
El area responsable registrará una orden de compra indicando los datos generales (cabecera) , el detalle de articulos y las condiciones de pago. Mientras se edita la OC permanece en estado "Inicial" hasta que el usuario confirma el cierre, pasandola a estado "Pendiente".
Por cada orden de compra se debe indicar:
- Normal o Directa
- Tipo de operación
- Usuario solicitante
- Fecha de necesidad
- Centro de Costo (Default)
- Proveedor
- Estado
- Fecha de estado
- Comentario

En la carga del detalle por cada linea de la OC el sistema asignará por default:
- Articulo: default parametrizado en el Tipo de Operacion. Ademas el Tipo de Operacion contará con un parametro denominado "Clase de Articulo". que se utilizará como filtro en el combobox desplegable para seleccionar un articulo. Por lo tanto debe crearse la entidad Clase de Articulo y vincularla tanto al Tipo de Operación como a Articulos.
- Centro de Costo: Cada item asumirá por default el centro de costo de la cabecera, aunque el usuario puede cambiar este parámetro en forma particular para una linea de la OC.

Aprobación: 
============
El supervisor correspondiente deberá aprobar o rechazar la orden de compra cambiando de estado desde "Pendiente" a "Aprobada" o "Rechazada". 

Confirmación: 
=================
Una vez que se verifica la recepción del material o servicio el responsable de la compra confirmará la Compra pasando la misma a "Completada".  

Compras Directas: 
=================
En las compras directas, donde la Orden de Compra la realiza el sector que tiene la necesidad (NO el area de compra), al confirmarse la compra, el sistema pedirá los datos de la factura (pdf, cuil del proveedor, numero, fecha, total , impuestos). Con estos parametros y los datos de la OC el sistema generará en forma automática la factura en un estado inicial, para que posteriormente administración controle la integridad y confirme su registración. Los datos de factura no forman parte del modelo de datos de la OC, se pedirán como parametro solo a los efectos de la generación automática de la factura. Cada linea de detalle de la factura  mantendrá una relación con el id de la linea de detalle de la OC que le dio origen.

Compras Normales: 
===================
El area de compras recibe el requerimiento de las areas que tienen la necesidad y crea una orden de compra en estado "Inicial". Cuando completó la carga pasa la OC a estado "Cotización" y solicita cotizaciones a diferentes proveedores, por cada cotizacion carga el proveedor, el PDF, el total, la fecha de cotización y un comentario en la OC. Cuando decide el proveedor completa los datos de precio y condiciones de pago en la OC y la cambia a "Pendiente" para que continúe con el ciclo normal de Aprobación y Confirmación. 

Estado
==================
Todos los cambios de estados de la OC deben quedar registrados en un log de estados identificando la fecha y el usuario que hizo el cambio. Esto nos permitirá consultar la historia y calcular metricas en el futuro.



