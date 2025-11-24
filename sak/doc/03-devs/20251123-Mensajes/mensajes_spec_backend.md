# Mensajes - Especificacion Backend (CRUD + workflow)

> **Contexto**: extender el backend CRM para soportar mensajes (entrada/salida) con flujo de confirmacion, resolucion de contacto, creacion/vinculacion de evento y oportunidad.  
> **Patron base**: FastAPI + SQLModel, CRUD generico existente.  
> **Relacion oficial**: `mensaje` -> `evento` -> `oportunidad`. El mensaje guarda `evento_id`; desde el evento se llega a la oportunidad.

---

## 1. Modelo de datos

### 1.1 Tabla `crm_mensajes`
- `id` (PK)
- `tipo` (enum: `entrada`, `salida`)
- `canal` (enum: `whatsapp`, `email`, `red_social`, `otro`)
- `contacto_id` (FK opcional a `crm_contactos`)
- `contacto_referencia` (string) — numero tel / email / handle
- `contacto_nombre_propuesto` (string, nullable) — solo para alta de nuevo contacto
- `oportunidad_generar` (bool, default false) — indica crear nueva oportunidad al confirmar
- `evento_id` (FK opcional a `crm_eventos`)
- `estado` (enum)
  - entradas: `nuevo`, `confirmado`, `descartado`
  - salidas: `pendiente`, `enviado`, `error_envio`
- `prioridad` (enum: `alta`, `media`, `baja`)
- `asunto` / `titulo` (string)
- `contenido` (text, markdown permitido)
- `adjuntos` (json array con `{path, nombre, tipo}`)
- `origen_externo_id` (string, nullable)
- `metadata` (json, incluye `llm_suggestions`)
- `responsable_id` (FK users)
- `creado_por`, `actualizado_por`, `created_at`, `updated_at`

### 1.2 Ajustes en `crm_eventos`
- Agregar FK `mensaje_id` (opcional) **solo si ya existe el campo**; de lo contrario, basta con `evento_id` en mensajes. Recomendacion: no duplicar, mantener la traza desde `mensajes`.

### 1.3 Ajustes en `crm_oportunidades`
- Sin cambios estructurales; se mantiene relacion via evento.

### 1.4 Indices sugeridos
- `idx_mensajes_estado_tipo`
- `idx_mensajes_canal_referencia`
- `idx_mensajes_evento_id`
- `idx_mensajes_contacto_id`

---

## 2. Seeds / catálogos
- Agregar choices estandar para `canal`, `tipo`, `estado` (entrada/salida) y `prioridad` a los catálogos/choices de dominio (si existen archivos seed JSON o fixtures iniciales).
- Opcional: insertar 1-2 registros de ejemplo (entrada whatsapp y email) para QA/manual.

---

## 3. Endpoints (FastAPI + CRUD genérico)

> Reutilizar el patron CRUD generico (`BaseCRUD`/`router_factory`) con personalizacion de validaciones en `create`/`update`.

### 3.1 Rutas principales (reutilizando CRUD genérico)
- Montar el router con el factory estándar (ejemplo):  
  ```python
  router = router_factory(
      model=Mensaje,
      create_schema=MensajeCreate,
      update_schema=MensajeUpdate,
      prefix="/crm/mensajes",
  )
  ```
- Endpoints CRUD expuestos por el factory:
- `POST /crm/mensajes/entrada` (alias de create, con `tipo=entrada` y `estado=nuevo` por defecto; internamente puede delegar en `create` con valores pre-seteados).
  - `GET /crm/mensajes` (lista paginada con filtros por estado, canal, tipo, responsable, contacto, texto libre).
  - `GET /crm/mensajes/{id}`
  - `PATCH /crm/mensajes/{id}` (actualizacion parcial: estado, responsable, metadata, adjuntos).
  - `DELETE /crm/mensajes/{id}` (solo si no esta confirmado).

### 3.2 Accion de confirmacion (wizard backend)
- `POST /crm/mensajes/{id}/confirmar`
  - Entrada:
    - `contacto_id` (opcional) o `{nombre, referencia}` para alta de nuevo contacto.
    - `evento`: `{tipo_evento_id, descripcion, fecha_evento, responsable_id, canal, resultado}`
    - `oportunidad`:
      - `oportunidad_id` (opcional, si se vincula existente)
      - `crear_nueva` (bool) + campos requeridos (`tipo_operacion_id`, `estado` inicial, `monto_estimado`, `moneda_id`, `propiedad_id` opcional, `responsable_id`, `probabilidad/etapa`, `fuente`="mensaje_confirmado")
    - `respuesta` (opcional, para preparar salida)
  - Flujo (reutilizando CRUD existentes):
    1) Resolver/crear contacto via `crud_contactos.create` si no existe.
    2) Crear evento con `crud_eventos.create`, referenciando el contacto y el mensaje.
    3) Crear o vincular oportunidad usando `crud_oportunidades` (create o update) segun corresponda.
    4) Actualizar mensaje via `crud_mensajes.update` (`evento_id`, `contacto_id`, `estado=confirmado`).
  - Respuesta: payload con mensaje + evento + oportunidad resultante.

### 3.3 Accion de descarte (usar CRUD genérico)
- No se expone endpoint extra: usar `PATCH /crm/mensajes/{id}` (CRUD base) con `estado="descartado"`, `motivo_descartado`, `comentario`. El servicio de update debe validar la transicion y registrar historial.

### 3.4 Accion de reintento de salida
- `POST /crm/mensajes/{id}/reintentar` (solo si `estado=error_envio`, cambia a `pendiente_envio` y registra historial).

### 3.5 Filtros inbox
- Defaults: `estado in (nuevo)` y `tipo=entrada`, `perPage=10`.
- Soportar `q` para texto libre en asunto/contenido.

### 3.6 Accion de sugerencias LLM (opcional, para pruebas)
- `POST /crm/mensajes/{id}/llm-sugerir`
  - Usa la misma integracion/credenciales que `pdf_extraction_service` (OpenAI / LLM actual).
  - Entrada: `{ "force": true }` opcional para refrescar, de lo contrario usa cache si `metadata.llm_suggestions` ya existe.
  - Flujo:
    1) Obtener mensaje.
    2) Llamar al servicio LLM (reutilizar cliente ya configurado) pasando contenido, canal y referencia.
    3) Guardar resultado en `metadata.llm_suggestions` via `crm_mensaje_crud.update`.
    4) Devolver las sugerencias (contacto, propiedad, oportunidad, resumen).

---

## 4. Validaciones / reglas (backend)
- No permitir `DELETE` si `estado=confirmado` o `estado` de salida distinto de `pendiente_envio`.
- `confirmar` solo si `tipo=entrada` y `estado=nuevo`.
- En `confirmar`, si `contacto_id` viene vacío:
  - Requerir `{nombre, referencia}` y crear contacto.
- En `confirmar`, si `crear_nueva=true`:
  - Requerir todos los campos obligatorios de oportunidad (tipo_operacion, estado, responsable, etc.).
- Si se vincula oportunidad existente:
  - Debe pertenecer al mismo contacto resuelto (o permitir override con flag si negocio lo acepta).
- Mantener integridad: `mensaje.evento_id` debe apuntar a un evento que referencie a la oportunidad elegida/creada.
- Estados de salida: transiciones permitidas (`pendiente_envio` -> `enviado`/`error_envio`; `error_envio` -> `pendiente_envio`).

---

## 5. Cambios en capa CRUD / router
- Crear `models/mensaje.py` con SQLModel; incluir enums de dominio reutilizando choices globales.
- Crear `schemas/mensaje.py` con Pydantic para `Create`, `Update`, y payloads de acciones (`ConfirmarPayload`, `DescartarPayload`, `ReintentarPayload`).
- Router `routers/mensajes.py` usando la fabrica CRUD, inyectando endpoints custom de `confirmar`, `descartar`, `reintentar`.
- Servicios auxiliares:
  - `services/mensajes.py`: orquestacion de confirmacion (resolver contacto, crear evento, crear/vincular oportunidad, actualizar mensaje).
  - Reusar `crud_contactos`, `crud_eventos`, `crud_oportunidades`.

---

## 6. Casos de prueba (API)

### 6.1 Crear mensaje de entrada
- `POST /crm/mensajes/entrada` con canal whatsapp y referencia telefonica.
- Assert: estado `nuevo`, tipo `entrada`, sin `evento_id`.

### 6.2 Confirmar mensaje creando contacto y oportunidad
- Dado un mensaje `nuevo` sin `contacto_id`.
- `POST /crm/mensajes/{id}/confirmar` con datos de contacto nuevo + crear oportunidad.
- Assert: se crea contacto, evento y oportunidad; mensaje queda `estado=confirmado`, `evento_id` seteado; oportunidad `estado=nueva`.

### 6.3 Confirmar mensaje vinculando contacto existente y oportunidad existente
- Dado contacto y oportunidad abierta.
- Confirmar con `contacto_id` y `oportunidad_id`.
- Assert: no se crea contacto ni oportunidad nueva; mensaje apunta a evento que referencia la oportunidad dada.

### 6.4 Descartar mensaje (via PATCH del CRUD)
- `PATCH /crm/mensajes/{id}` con `estado="descartado"` y `motivo_descartado`.
- Assert: `estado=descartado`, registra historial, no genera evento.

### 6.5 Reintentar salida
- Preparar mensaje de salida en `error_envio`.
- `POST /crm/mensajes/{id}/reintentar`.
- Assert: pasa a `pendiente_envio`, agrega log de reintento.

### 6.6 Reglas de transicion invalidas
- Confirmar un mensaje ya confirmado -> 400.
- Reintentar un mensaje que no esta en `error_envio` -> 400.
- Vincular oportunidad de otro contacto sin flag de override -> 400.

### 6.7 Filtros de inbox
- `GET /crm/mensajes?estado=nuevo&tipo=entrada&perPage=10`.
- Assert: solo devuelve pendientes, paginacion funciona.

---

## 7. Checklist tecnico
- [ ] Modelo `crm_mensajes` creado con migracion Alembic.
- [ ] Seeds/choices actualizados para enums de mensajes.
- [ ] CRUD basico funcionando (lista, show, create, update, delete con restricciones).
- [ ] Endpoints custom `confirmar`, `descartar`, `reintentar` implementados y testeados.
- [ ] Servicios reusando CRUDs de contacto, evento, oportunidad.
- [ ] Tests de API automatizados (Pytest) cubriendo casos 6.1–6.7.
- [ ] Documentacion OpenAPI actualizada (describir payloads del wizard de confirmacion).
- [ ] Logs de historial de estados para auditoria.

---

## 8. Notas de implementacion
- Mantener los textos en espanol neutro en mensajes de error y logs.
- Para performance en inbox, aplicar filtros y paginacion en SQL (no en memoria).
- LLM: si se integra, hacerlo como servicio opcional reutilizando el cliente y credenciales que ya usa `pdf_extraction_service` (OpenAI u otro). Almacenar sugerencias en `metadata.llm_suggestions` y no bloquear la confirmacion si falla la llamada.
