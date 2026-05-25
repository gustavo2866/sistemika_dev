# Pedidos de Obra desde Chat - Especificacion Tecnica

## Objetivo

Permitir que los pedidos generados por el agente desde WhatsApp queden como una entidad editable por ingenieros de obra antes de generar ordenes de compra (`po_orders`).

El flujo esperado es:

1. El agente confirma un pedido desde chat.
2. Se crea un `pedido_obra` formal con sus lineas.
3. El ingeniero revisa y edita las lineas.
4. El ingeniero confirma el pedido revisado.
5. El sistema genera una o varias `po_orders`, agrupando lineas por `tipo_solicitud_id`.

## Alcance

Incluye:

- Modelo de datos para pedidos confirmados por agente.
- Edicion de lineas: articulo, cantidad, altas y bajas.
- Validaciones de negocio.
- Generacion de `po_orders` y `po_order_details`.
- Recursos backend y frontend.

No incluye:

- Flujo de aprobacion posterior de `po_orders`.
- Cotizaciones o seleccion de proveedor.
- Facturacion.

## Modelo De Datos

### Tabla `constructora_pedidos`

Representa un pedido confirmado desde el chat y revisable por obra.

Campos:

```text
id
oportunidad_id              FK crm_oportunidades.id, requerido
contacto_id                 FK crm_contactos.id, opcional
mensaje_origen_id           FK crm_mensajes.id, requerido
estado                      pendiente | revisado | emitido | cancelado
origen                      agente | manual
titulo                      string
observaciones               text, opcional
solicitante_id              FK users.id, opcional
responsable_revision_id     FK users.id, opcional
fecha_confirmacion_agente   datetime
fecha_revision              datetime, opcional
fecha_generacion_po         datetime, opcional
metadata                    JSONB
created_at
updated_at
deleted_at
version
```

Estados:

```text
pendiente: editable, aun no revisado
revisado: validado por ingeniero, listo para generar PO
emitido: ya genero una o mas po_orders
cancelado: descartado
```

Origen:

```text
agente: creado automaticamente desde el chat (WhatsApp)
manual: creado por un usuario desde el backoffice
```

La constraint de unicidad sobre `mensaje_origen_id` aplica solo cuando `origen = agente`.

### Tabla `constructora_pedido_detalles`

Lineas editables del pedido.

Campos:

```text
id
pedido_id                   FK constructora_pedidos.id, requerido
articulo_id                 FK articulos.id, requerido para generar PO
tipo_solicitud_id           FK tipos_solicitud.id, requerido para generar PO
descripcion_original        string, texto detectado por el agente
descripcion                 string, editable
unidad_medida               string, opcional
cantidad                    decimal(12,3), requerido > 0
centro_costo_id             FK centros_costo.id, opcional
po_order_id                 FK po_orders.id, opcional
po_order_detail_id          FK po_order_details.id, opcional
orden                       int
metadata                    JSONB
created_at
updated_at
deleted_at
version
```

Regla importante:

- `tipo_solicitud_id` puede venir del `articulo` o ser elegido manualmente.
- La generacion de PO agrupa por `tipo_solicitud_id`.

## Relacion Con El Agente

Hoy el agente deja el pedido confirmado en:

```text
crm_mensajes.metadata.agent_v2.result
```

Al detectar:

```json
{
  "type": "pedido_obra_reply",
  "pedido_listo": true
}
```

el backend debe crear un `constructora_pedidos` si todavia no existe para ese `mensaje_origen_id`.

La creacion debe ser idempotente:

- Un mismo `mensaje_origen_id` no puede crear dos pedidos.
- Agregar constraint unico: `constructora_pedidos.mensaje_origen_id`.

### Momento De Creacion

El pedido formal se crea en el backend al finalizar un turno del agente en el que el resultado indica pedido confirmado.

Condicion disparadora:

```text
crm_mensajes.metadata.agent_v2.result.type = "pedido_obra_reply"
crm_mensajes.metadata.agent_v2.result.pedido_listo = true
```

Punto recomendado de integracion:

1. El webhook guarda el mensaje entrante en `crm_mensajes`.
2. El orquestador ejecuta `pedido_obra`.
3. El orquestador persiste `agent_v2.result` en el mensaje.
4. Si `pedido_listo = true`, se agenda una tarea asincronica de materializacion.
5. El flujo del chat continua sin esperar la creacion del pedido formal.
6. La tarea asincronica llama al servicio backend `create_from_agent_message(session, mensaje_id)`.
7. El servicio crea `constructora_pedidos` y `constructora_pedido_detalles` en una sola transaccion.
8. El backend guarda el `pedido_obra_id` creado en `crm_mensajes.metadata.agent_v2.pedido_obra_id`.

Este paso debe ejecutarse dentro del backend, no desde el frontend y no mediante un endpoint HTTP interno.
El webhook/agente ya corre dentro del backend; por lo tanto debe llamar a un servicio de dominio directo.

La materializacion del pedido no debe agregar demora perceptible al chat. Si falla, debe quedar registrada para reintento.
La idempotencia por `mensaje_origen_id` permite ejecutar el reintento sin duplicar pedidos.

## Backend

### Modelos

Crear:

```text
backend/app/models/constructora/pedido.py
backend/app/models/constructora/__init__.py
```

Clases:

```python
ConstructoraPedido
ConstructoraPedidoDetalle
```

Usar `Base`, soft delete y `version`.

### CRUD

Usar `NestedCRUD` para sincronizar `detalles`.

Router:

```text
backend/app/routers/constructora_pedido_router.py
```

Endpoints CRUD:

```text
GET    /constructora/pedidos
GET    /constructora/pedidos/{id}
POST   /constructora/pedidos
PUT    /constructora/pedidos/{id}
PATCH  /constructora/pedidos/{id}
DELETE /constructora/pedidos/{id}
```

Acciones de dominio:

```text
POST /constructora/pedidos/from-agent-message/{mensaje_id}
POST /constructora/pedidos/{id}/validar
POST /constructora/pedidos/{id}/generar-po
POST /constructora/pedidos/{id}/cancelar
```

El endpoint `from-agent-message` queda reservado para reparacion, reproceso manual o tareas administrativas.
El flujo normal del agente no debe consumir ese endpoint por HTTP; debe usar el servicio backend directo.

### Servicio Backend

Crear:

```text
backend/app/services/constructora_pedido_service.py
```

Funciones principales:

```python
create_from_agent_message(session, mensaje_id) -> ConstructoraPedido
enqueue_from_agent_message(mensaje_id) -> None
validate_pedido(session, pedido_id) -> ValidationResult
generate_po_orders(session, pedido_id, usuario_id) -> list[PoOrder]
cancel_pedido(session, pedido_id, usuario_id) -> ConstructoraPedido
```

### Creacion Desde Agente

La creacion desde el agente se compone de dos pasos:

1. `enqueue_from_agent_message(mensaje_id)`: agenda la materializacion sin bloquear el chat.
2. `create_from_agent_message(session, mensaje_id)`: crea la entidad formal.

`create_from_agent_message` debe:

1. Cargar `CRMMensaje`.
2. Leer `metadata_json["agent_v2"]["result"]`.
3. Validar `pedido_listo == True`.
4. Validar que no exista otro pedido activo con el mismo `mensaje_origen_id`.
5. Crear `ConstructoraPedido`.
6. Crear lineas desde `result.items`.
7. Guardar referencia a `mensaje_origen_id`.
8. Dejar estado `pendiente` y origen `agente`.

La insercion debe crear cabecera y detalle completos en una sola transaccion.

Mapeo de item del agente:

```text
item.descripcion  -> descripcion_original, descripcion
item.cantidad     -> cantidad
item.unidad       -> unidad_medida
item.item_id      -> metadata.agent_item_id
```

### Generacion De PO

`generate_po_orders` debe:

1. Validar que el pedido este en `revisado`.
2. Validar que todas las lineas activas tengan:
   - `articulo_id`
   - `tipo_solicitud_id`
   - `cantidad > 0`
3. Agrupar lineas por `tipo_solicitud_id`.
4. Crear una `PoOrder` por grupo.
5. Crear `PoOrderDetail` por cada linea.
6. Escribir en cada linea:
   - `po_order_id`
   - `po_order_detail_id`
7. Cambiar pedido a `emitido`.

Campos sugeridos para `PoOrder`:

```text
titulo: "Pedido de obra #{pedido.id}"
tipo_solicitud_id: grupo.tipo_solicitud_id
order_status_id: estado inicial de po_order_status
solicitante_id: usuario que genera o solicitante del pedido
oportunidad_id: pedido.oportunidad_id
centro_costo_id: si aplica desde pedido/linea
comentario: referencia al pedido y mensaje origen
total: 0
```

Campos para `PoOrderDetail`:

```text
order_id
articulo_id
descripcion
unidad_medida
cantidad
precio: 0
importe: 0
centro_costo_id
oportunidad_id
```

La operacion debe ser transaccional: si falla una PO o un detalle, no debe quedar nada parcial.

## Validaciones

### Pedido

- No se puede editar si `estado = emitido`.
- No se puede generar PO si `estado != revisado`.
- No se puede cancelar si ya genero PO (`estado = emitido`).
- `mensaje_origen_id` debe ser unico.

### Lineas

- Debe existir al menos una linea activa.
- `cantidad` requerida y mayor a 0.
- `articulo_id` requerido para generar PO.
- `tipo_solicitud_id` requerido para generar PO.
- `descripcion` requerida si no hay `articulo_id`.
- Si se cambia `articulo_id`, recalcular sugerencias:
  - `descripcion`
  - `unidad_medida`
  - `tipo_solicitud_id`, si puede inferirse

### Agrupacion

- Una PO por cada `tipo_solicitud_id`.
- Las lineas sin `tipo_solicitud_id` bloquean la generacion.
- Si un tipo de solicitud no tiene configuracion valida, bloquear con error claro.

## Frontend

Crear recurso:

```text
frontend/src/app/resources/constructora/pedidos/
```

Archivos:

```text
index.ts
model.ts
list.tsx
show.tsx
edit.tsx
form.tsx
```

Registrar en:

```text
frontend/src/app/admin/AdminApp.tsx
```

Resource name:

```text
constructora/pedidos
```

### Lista

Columnas:

- ID
- Oportunidad
- Estado
- Fecha confirmacion agente
- Cantidad de lineas
- Responsable revision
- Acciones

Filtros:

- `estado`
- `oportunidad_id`
- `q`
- rango de fecha

Acciones:

- Ver
- Editar
- Generar PO, solo si `estado = revisado`
- Cancelar, solo si `estado != emitido`
- Badge de origen ("Desde chat" si `origen = agente`)

### Formulario

Cabecera:

- Titulo
- Oportunidad
- Estado
- Observaciones
- Responsable revision

Detalle editable:

- Articulo
- Descripcion
- Cantidad
- Unidad
- Tipo de solicitud
- Centro de costo
- Acciones de fila

Operaciones de linea:

- Asignar articulo
- Modificar cantidad
- Agregar linea
- Eliminar linea

Usar componentes existentes de detalle tipo `FormDetailSection` / `SectionDetailTemplate2` si aplican.

### Validacion Frontend

En `model.ts` usar schema con reglas:

- `detalles.length >= 1`
- `cantidad > 0`
- antes de generar PO, todas las lineas deben tener `articulo_id` y `tipo_solicitud_id`

El frontend puede permitir guardar con lineas incompletas, pero debe bloquear `Generar PO`.

## UX Esperada

Estados visuales:

```text
pendiente: requiere accion
revisado: listo para PO
emitido: cerrado
cancelado: cerrado
```

Botones:

- `Guardar`
- `Marcar revisado`
- `Generar PO`
- `Cancelar pedido`

Al generar PO mostrar resumen:

```text
Se generaran 3 ordenes:
- Materiales: 5 lineas
- Servicios: 2 lineas
- Equipos: 1 linea
```

Luego mostrar links a las `po_orders` creadas.

## Integracion Con Chat

Cuando se confirme desde WhatsApp:

1. El agente responde el pedido formal.
2. El backend crea `constructora_pedidos`.
3. El pedido queda visible para revision.

El mensaje CRM debe conservar metadata:

```json
{
  "agent_v2": {
    "result": { "...": "..." },
    "pedido_obra_id": 123
  }
}
```

Esto permite navegar desde el chat al pedido formal.

## Migraciones

Crear migracion Alembic:

```text
constructora_pedidos
constructora_pedido_detalles
```

Indices:

```text
constructora_pedidos.oportunidad_id
constructora_pedidos.estado
constructora_pedidos.mensaje_origen_id unique
constructora_pedido_detalles.pedido_id
constructora_pedido_detalles.articulo_id
constructora_pedido_detalles.tipo_solicitud_id
constructora_pedido_detalles.po_order_id
```

## Tests

Backend:

- Crear pedido desde mensaje confirmado.
- Idempotencia por `mensaje_origen_id`.
- Editar cantidad.
- Asignar articulo.
- Agregar linea.
- Eliminar linea.
- Validar bloqueo si falta articulo.
- Validar bloqueo si falta tipo de solicitud.
- Generar N `po_orders` agrupadas por `tipo_solicitud_id`.
- Rollback si falla la generacion.

Frontend:

- Render de lista.
- Formulario con detalle editable.
- Validacion de cantidad.
- Boton `Generar PO` deshabilitado si faltan datos.
- Accion exitosa muestra links a PO creadas.

## Preguntas Pendientes

- Como se infiere `tipo_solicitud_id` desde `articulo`: campo directo, tipo de articulo o regla configurable.
- Si `centro_costo_id` se define por pedido, por linea o por oportunidad/proyecto.
- Estado inicial exacto de `po_order_status`.
- Usuario solicitante por defecto: ingeniero que confirma, responsable de oportunidad o usuario del sistema.
