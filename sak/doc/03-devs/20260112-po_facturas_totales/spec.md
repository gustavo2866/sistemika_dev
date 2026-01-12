# Spec - po_facturas totales

## Contexto
Basado en `doc/03-devs/20260112-po_facturas_totales/definicion.md`.
Se debe crear una entidad de totales de factura con lineas por concepto y centro de costo,
con dos tipos: `subtotal` (calculado) e `impuesto` (manual).

## Alcance
- Backend: modelo, migracion, CRUD/servicio, routers/endpoints.
- DB: nueva tabla, FKs e indices.
- Frontend: nueva seccion "Totales" en el formulario de `po_facturas`.
- Alinear con lineamientos de `AGENTS.md` y patrones CRUD.

## Modelo de datos (nuevo)
Tabla propuesta: `po_factura_totales`

Campos:
- `id` (Base)
- `factura_id` FK -> `po_facturas.id` (obligatorio)
- `concepto_id` FK -> `adm_conceptos.id` (obligatorio)
- `centro_costo_id` FK -> `centros_costo.id` (opcional)
- `tipo` string enum: `subtotal` | `impuesto` (obligatorio)
- `descripcion` string(50) (opcional, editable)
- `importe` numeric(12,2) (obligatorio)
- `created_at`, `updated_at`, `deleted_at`, `version` (Base)

Relaciones:
- `PoFactura.totales` (one-to-many)
- `PoFacturaTotal.concepto` (many-to-one)
- `PoFacturaTotal.centro_costo` (many-to-one)

Indices/constraints:
- index por `factura_id`
- index por `concepto_id`, `centro_costo_id`, `tipo`
- unique sugerido: (`factura_id`, `tipo`, `concepto_id`, `centro_costo_id`)
- orden de listado: tipo desc (subtotal, impuesto), luego concepto

## Logica de negocio
Subtotales:
- Se calculan a partir de `po_facturas.detalles`.
- Agrupar por `concepto_id` (desde `tipos_articulo -> adm_concepto`) y `centro_costo_id`.
- Se recalculan en cada create/update del detalle y en create/update de la factura.
- No editables desde UI/API (solo lectura).
- El tipo se asigna automaticamente como `subtotal`.

Impuestos:
- Se gestionan manualmente por el usuario.
- Se guardan como `tipo="impuesto"` en `po_factura_totales`.
- Son editables en UI/API.
- El tipo se asigna automaticamente como `impuesto` desde el subform.

Totales generales:
- `po_facturas.subtotal` debe reflejar la suma de subtotales.
- `po_facturas.total_impuestos` debe reflejar la suma de impuestos.
- `po_facturas.total` debe reflejar subtotal + impuestos.
- Se recalculan en backend para evitar inconsistencias.
- Redondeo: 2 decimales.

## Backend
### Modelo
- Agregar modelo en `backend/app/models/compras.py` junto con `po_*`.
- Agregar a `backend/app/models/__init__.py`.
- Agregar relacion en `backend/app/models/compras.py` para `PoFactura.totales`.

### CRUD/servicios
- CRUD generico para `PoFacturaTotal`.
- En `po_factura` create/update:
  - Recalcular subtotales (tipo `subtotal`) y sincronizar tabla:
    - upsert por (`factura_id`, `tipo`, `concepto_id`, `centro_costo_id`)
    - eliminar subtotales ya no presentes
  - Recalcular totales generales (`subtotal`, `total_impuestos`, `total`).
- Para `tipo="impuesto"` permitir create/update/delete desde CRUD.
- Validar que `tipo="subtotal"` no pueda ser editado manualmente.
- Forzar `tipo` desde backend segun origen (subtotal calculado, impuesto manual).

### Routers/endpoints
- Router generico `po_factura_totales` (nuevo recurso REST).
- Extender nested payloads en `po_facturas` para incluir `totales`:
  - aceptar `totales` solo para `tipo="impuesto"`.
  - ignorar/bloquear escritura para `subtotal`.
  - forzar `tipo="impuesto"` al crear/editar desde subform.

## DB / Migracion
- Crear migracion Alembic:
  - Crear tabla `po_factura_totales` con FKs e indices.
  - Backfill para facturas existentes:
    - generar subtotales desde detalles
    - dejar impuestos vacios (o migrar desde seccion actual si aplica).
  - Recalcular `subtotal`, `total_impuestos`, `total` por factura.

## Frontend (po_facturas/form)
- Agregar seccion "Totales" debajo de "Detalle".
- Mostrar lista de subtotales (solo lectura):
  - columnas: concepto, centro de costo, descripcion, importe.
  - origen: `tipo="subtotal"`.
  - tarjeta muestra nombre de concepto y centro de costo.
- Permitir gestionar impuestos (editable):
  - lista con add/edit/delete
  - origen: `tipo="impuesto"`.
  - tipo asignado automaticamente en el subform.
- Reemplaza la seccion actual de `impuestos`.
- Recalculo de subtotales en tiempo real (frontend).
- Orden de lista: tipo desc (subtotal primero), luego concepto.
- Respetar patrones CRUD frontend (cards responsive, wrappers compact).

## QA / Tests
- Tests de recalculo con cambios en detalles:
  - alta, edicion, baja de detalle.
- Tests de permisos:
  - no permitir editar `subtotal` via API.
- Tests de endpoints:
  - CRUD de `impuesto` funciona y recalcula totales generales.

## Respuestas aplicadas
- `centro_costo_id` es opcional (null permitido).
- La seccion actual de `impuestos` se reemplaza por `totales`.
- Recalculo en tiempo real en frontend.
- `descripcion` es texto libre editable por el usuario (max 50, no obligatorio).
- No se requiere historico/auditoria para impuestos.
- Redondeo a 2 decimales.
