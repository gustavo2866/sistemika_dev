# Mensajes - Especificacion Frontend

> **Contexto:** Implementar el módulo de mensajes CRM (entrada/salida) respetando el patrón CRUD genérico (`List` + `DataTable` + `SimpleForm`) y la UX de inbox amigable (estilo correo) definida en `mensajes_req`.

---

## 1. Alcance
- Vistas React (Next.js app router) para `crm/mensajes`: listado (inbox), confirmación (wizard), detalle y acciones de salida/reintento.
- Reutilizar componentes base: `List`, `DataTable`, `FilterButton`, `SimpleForm`, `FormLayout`, `ReferenceInput`, `SelectInput`, etc.
- Paginación por defecto 10 ítems (`perPage={10}`) en listas CRM.

---

## 2. Listado (Inbox)
- **Ruta**: `src/app/resources/crm-mensajes/List.tsx`.
- **Componentes**: `List` + `DataTable` con `perPage={10}`. Usar vista responsiva móvil por defecto (ya provista por `DataTable`).
- **UX estilo email**:
  - Panel de lista con columnas: fecha (creación), contacto (o “Sin contacto”), canal, tipo (entrada/salida), estado, responsable, resumen del contenido (primeros ~120-140 caracteres).
  - Panel de detalle (modal o slide-over) al hacer rowClick: muestra contenido completo, adjuntos, historial de estados y acciones contextuales.
  - Filtro por defecto: estado `nuevo` y tipo `entrada` para mostrar pendientes de confirmar.
- **Filtros**:
  - `q` (busca en asunto/contenido)
  - `estado` (SelectInput con estados de entrada y salida)
  - `tipo` (entrada/salida)
  - `canal` (whatsapp/email/red_social/otro)
  - `responsable_id` (ReferenceInput users)
  - `contacto_id` (ReferenceInput crm/contactos)
  - rango de fechas (si hay componente disponible; opcional)
- **Acciones por fila**:
  - Entrada `nuevo`: Confirmar (abre wizard), Descartar (PATCH estado=descartado).
  - Entrada `confirmado`: Ver detalle.
  - Salida `error_envio`: Reintentar.
  - Todas: Mostrar detalle/adjuntos.

---

## 3. Wizard de confirmación
- **Ruta**: `src/app/resources/crm-mensajes/Confirmar.tsx` (o modal embebido).
- **Pasos mínimos**:
  1) **Contacto**: buscar por referencia (tel/email), mostrar sugerencias (incl. `metadata.llm_suggestions`), permitir crear nuevo contacto ingresando nombre + referencia y asignar responsable.
  2) **Oportunidad**: si hay abiertas del contacto, proponer una; si no, opción “crear nueva” con campos requeridos (tipo_operacion_id, estado inicial, propiedad opcional, responsable, monto/moneda si aplica).
  3) **Evento y respuesta**: capturar tipo_evento, motivo_evento, descripción, fecha_evento (default ahora), responsable. Campo opcional para preparar respuesta de salida.
- Validar cada paso antes de avanzar; deshabilitar “Confirmar” hasta completar requeridos.
- Al finalizar, llamar `POST /crm/mensajes/{id}/confirmar` con payload del wizard.

---

## 4. Formularios y componentes
- **List**: seguir el patrón de `patterns_frontend/List.template.md` con `perPage={10}` y filtros descritos arriba.
- **Confirmación**: usar `SimpleForm` + `FormLayout` dividido por pasos; aprovechar `ReferenceInput` para contacto/oprtunidad cuando existan, y `TextInput/SelectInput` para alta rápida de datos mínimos.
- **Detalle/Show**: slide-over/modal que muestra contenido, adjuntos, `estado`, `contacto`, `canal`, `origen_externo_id`, historial (si se expone).
- **Botones**: Confirmar, Descartar, Reintentar (según estado y tipo).

---

## 5. Integración con endpoints
- **CRUD base**: `/crm/mensajes` (GET/POST/PATCH/DELETE). Para entradas usar `/crm/mensajes/entrada`.
- **Confirmar**: `POST /crm/mensajes/{id}/confirmar`.
- **Reintentar salida**: `POST /crm/mensajes/{id}/reintentar`.
- **Descarte**: PATCH al recurso con `estado="descartado"` y `motivo_descartado`.
- Los filtros deben mapear a los campos del modelo (`estado`, `tipo`, `canal`, `responsable_id`, `contacto_id`, `q` para asunto/contenido).

---

## 6. Estado y UI
- Mostrar en la lista badges para `estado` y `tipo`.
- Resumen de contenido truncado en tabla, completo en panel de detalle.
- Adjuntos: si existen, listarlos con enlace/download.
- Errores/reintentos: en salida `error_envio`, habilitar acción de reintento y mostrar último error (si viene en metadata).

---

## 7. Pruebas manuales sugeridas
- Crear mensaje de entrada y confirmarlo (con contacto nuevo).
- Confirmar vinculando contacto y oportunidad existente.
- Descartar mensaje pendiente.
- Reintentar mensaje de salida en error.
- Verificar filtros por estado/tipo/canal/responsable.
- Ver en móvil que `DataTable` muestre tarjetas (useIsMobile) con campos clave: contacto, canal, estado, resumen.

---

## 8. Referencias
- Patrones: `doc/03-devs/patterns_frontend/pattern_frontend.md` y plantillas `.md`.
- Requerimientos: `doc/03-devs/20251123-Mensajes/20251123_mensajes_req.md`.
