# Agente Tecnico

## Objetivo

Este documento define la especificacion tecnica base del agente
conversacional.

Complementa a:

- `agente_proceso.md`, que define el marco general del agente
- `agente_solicitud.md`, que define el proceso funcional de
  `solicitud_materiales`

El objetivo de este documento es traducir ese marco funcional a contratos,
componentes y estructuras tecnicas concretas, segun la implementacion actual.

## Alcance

Este documento define:

- configuracion operativa del agente
- estado persistido del agente
- contrato del orquestador de turnos
- interfaz comun para procesos conectables
- contrato de contexto y resultado de turno
- componentes tecnicos principales
- reglas de idempotencia, concurrencia y trazabilidad
- estrategia de prompts y adaptadores de canal
- estructura real de modulos del agente v2

No describe el detalle funcional fino de cada proceso de negocio.

## Principios tecnicos

- el backend procesa cada turno de forma deterministica en sus limites
- el estado del agente se persiste del lado backend
- el orquestador es agnostico del proceso concreto
- cada proceso implementa una interfaz comun
- el LLM se usa por medio de puertos bien definidos
- el envio de mensajes salientes reutiliza adaptadores de canal
- la automatizacion es idempotente
- la inferencia sobre lenguaje natural debe vivir principalmente en el LLM
- el backend solo mantiene inferencia estructurada y controlada, por ejemplo el
  mapeo deterministico de respuestas a atributos pendientes

## Configuracion operativa

### Fuentes de configuracion

La modalidad se resuelve en este orden:

1. `settings.clave = "crm_chat_agent_mode"`
2. variable de entorno `CRM_CHAT_AGENT_MODE`
3. fallback `manual`

La variable de entorno sigue existiendo como respaldo operativo:

```env
CRM_CHAT_AGENT_MODE=manual
```

Valores:

- `manual`
- `automatic`
- `hybrid`

### Semantica

- `manual`: el webhook registra el mensaje y delega igual al orquestador, pero
  el orquestador difiere el procesamiento especializado cuando
  `trigger=webhook`
- `automatic`: el mensaje entrante se procesa automaticamente
- `hybrid`: el mensaje se procesa automaticamente, pero la interfaz manual
  sigue disponible para reintento, inspeccion o soporte

### Regla importante

La modalidad no cambia la logica del proceso especializado.

Solo cambia:

- el disparador del turno
- la politica de entrega de la salida

En otras palabras:

- `manual` y `automatic` convergen en el mismo `process_turn(...)`
- la diferencia esperada es `preview_only` contra `auto_send`

### Fuente de verdad

La configuracion se lee en backend.

El frontend puede consultar y actualizar la configuracion persistida desde CRM
Setup, pero no decide la modalidad efectiva por cuenta propia: el orquestador
siempre resuelve el valor final en backend.

## Artefactos principales actuales

### Framework general

- `backend/agente/v2/core/orchestrator.py`
- `backend/agente/v2/core/context_loader.py`
- `backend/agente/v2/core/process_registry.py`
- `backend/agente/v2/core/state_repository.py`
- `backend/agente/v2/core/models.py`
- `backend/agente/v2/core/contracts.py`
- `backend/agente/v2/core/runtime.py`

### Proceso actual

- `backend/agente/v2/processes/solicitud_materiales/handler.py`
- `backend/agente/v2/processes/solicitud_materiales/llm_client.py`
- `backend/agente/v2/processes/solicitud_materiales/request_validation.py`
- `backend/agente/v2/processes/solicitud_materiales/operation_execution.py`
- `backend/agente/v2/processes/solicitud_materiales/attribute_mapping.py`
- `backend/agente/v2/processes/solicitud_materiales/request_store.py`

### Infraestructura

- `backend/agente/v2/infrastructure/channels/crm_channel_adapter.py`
- `backend/agente/v2/shared/text_normalization.py`

## Componentes principales

### 1. Turn Orchestrator

Responsabilidad:

- recibir un mensaje objetivo ya persistido
- construir contexto
- determinar modalidad, `trigger` y `delivery_mode`
- resolver proceso
- ejecutar el proceso correspondiente
- persistir resultado
- enviar respuesta o devolver preview segun corresponda

Artefacto actual:

- `backend/agente/v2/core/orchestrator.py`

### 2. Context Loader

Responsabilidad:

- cargar mensaje objetivo
- cargar oportunidad y contacto
- cargar estado del agente
- cargar estado del proceso activo
- cargar historial breve
- cargar catalogos o definiciones auxiliares

Artefacto actual:

- `backend/agente/v2/core/context_loader.py`

### 3. Process Registry

Responsabilidad:

- registrar procesos disponibles
- resolver prioridades
- entregar el handler correspondiente

Artefacto actual:

- `backend/agente/v2/core/process_registry.py`

### 4. Process Handler

Responsabilidad:

- implementar la logica de un proceso concreto
- interpretar el turno dentro de su dominio
- devolver un resultado estructurado

Artefacto actual de `solicitud_materiales`:

- `backend/agente/v2/processes/solicitud_materiales/handler.py`

### 5. Agent State Repository

Responsabilidad:

- persistir estado global del agente por conversacion
- cargar y actualizar estado del proceso activo
- registrar referencias del ultimo turno procesado
- persistir bitacora de ejecuciones por turno

Artefacto actual:

- `backend/agente/v2/core/state_repository.py`

### 6. Channel Adapter

Responsabilidad:

- enviar mensajes salientes por el canal correcto
- encapsular integracion con WhatsApp u otros canales futuros

Artefacto actual:

- `backend/agente/v2/infrastructure/channels/crm_channel_adapter.py`

### 7. LLM Client

Responsabilidad:

- exponer metodos estructurados para prompts especificos
- devolver respuestas parseadas y validadas

Artefacto actual:

- `backend/agente/v2/processes/solicitud_materiales/llm_client.py`

## Unidad de procesamiento

La unidad tecnica del agente es el `turno`.

Cada turno se identifica por un mensaje objetivo concreto.

No debe procesarse "el ultimo mensaje" en abstracto cuando el flujo sea
automatico. Debe procesarse un `message_id` explicito para evitar condiciones
de carrera y errores de secuencia.

## Estado persistido del agente

Se persiste un estado por oportunidad.

Nombre conceptual:

- `agent_conversation_state`

Ubicacion local actual:

- `backend/agente/v2/core/state/conversation_state/oportunidad_{id}.json`

### Campos base

```json
{
  "scope_type": "oportunidad",
  "scope_id": 123,
  "agent_mode": "manual",
  "active_process": "solicitud_materiales",
  "active_substate": "completa_atributos",
  "last_processed_message_id": 456,
  "last_inbound_message_id": 456,
  "last_outbound_message_id": 789,
  "version": 3,
  "process_states": {
    "solicitud_materiales": {}
  },
  "metadata": {}
}
```

### Descripcion de campos

- `scope_type`: tipo de ambito del agente
- `scope_id`: identificador del ambito, hoy oportunidad
- `agent_mode`: modalidad efectiva del agente
- `active_process`: proceso con prioridad actual
- `active_substate`: subestado del proceso activo
- `last_processed_message_id`: ultimo mensaje procesado por el orquestador
- `last_inbound_message_id`: ultimo mensaje entrante registrado
- `last_outbound_message_id`: ultimo mensaje saliente generado por el agente
- `version`: version tecnica del estado para control de concurrencia
- `process_states`: mapa de estados por proceso
- `metadata`: auditoria o flags auxiliares

### Estado por proceso

Cada proceso persiste su estado dentro de `process_states`.

Ejemplo actual:

```json
{
  "process_states": {
    "solicitud_materiales": {
      "status": "ready",
      "items": [],
      "observaciones": [],
      "pending_query": null,
      "last_user_intent": "show_request",
      "last_agent_prompt": "Te detallo la solicitud...",
      "awaiting_user_decision": "continue_or_close",
      "ready_for_confirmation": true,
      "last_operation_summary": null,
      "last_request_action": "show",
      "updated_at": "2026-04-03T10:15:00Z"
    }
  }
}
```

## Estado tecnico de `solicitud_materiales`

El proceso usa dos persistencias separadas:

- estado conversacional general en `core/state/conversation_state/`
- solicitud de materiales en `core/state/material_requests/`

Ubicacion local actual de la solicitud:

- `backend/agente/v2/core/state/material_requests/oportunidad_{id}.json`

### Solicitud persistida

```json
{
  "oportunidad_id": 123,
  "activa": true,
  "estado_solicitud": "draft",
  "version": 2,
  "ultimo_mensaje_id": 456,
  "items": [],
  "observaciones": []
}
```

### Estado conversacional del proceso

El `process_state` actual agrega metadatos de dialogo:

- `pending_query`: consulta pendiente activa
- `last_user_intent`: ultima intencion estructurada interpretada
- `last_agent_prompt`: ultimo mensaje guia emitido por el backend
- `awaiting_user_decision`: decision que el backend espera del usuario
- `ready_for_confirmation`: si la solicitud ya esta lista para revision/cierre
- `last_operation_summary`: resumen textual del ultimo cambio aplicado
- `last_request_action`: ultima accion estructurada sobre la solicitud

### Regla

El backend no usa estos campos para inferir lenguaje natural libre.

Los usa para:

- reconstruir el estado del dialogo
- decidir el siguiente paso del flujo
- guiar la respuesta cuando la solicitud esta en `revision`

## Contrato del turno

### Entrada del orquestador

El orquestador procesa una entrada minima de este tipo:

```json
{
  "message_id": 456,
  "trigger": "webhook",
  "delivery_mode": "auto_send",
  "requested_mode": null,
  "requested_process": null
}
```

### Campos

- `message_id`: mensaje objetivo ya persistido
- `trigger`: origen del disparo, por ejemplo `webhook`, `manual_button`,
  `retry`
- `delivery_mode`: politica de entrega, por ejemplo `auto_send`,
  `preview_only`
- `requested_mode`: override opcional para testing o tooling interno
- `requested_process`: proceso sugerido por una accion manual, si existiera
- `force_reprocess`: override opcional de idempotencia

## Contexto del turno

El `Context Loader` construye un objeto de este tipo:

```json
{
  "message": {},
  "conversation": {},
  "agent_state": {},
  "active_process_state": {},
  "recent_messages": [],
  "definitions": {},
  "runtime": {
    "trigger": "webhook",
    "agent_mode": "automatic",
    "delivery_mode": "auto_send"
  }
}
```

### Reglas

- `message` debe ser el mensaje objetivo exacto
- `recent_messages` debe ser breve y relevante
- `definitions` debe incluir solo lo necesario para el turno
- `active_process_state` puede ser `null` si no hay proceso activo

Implementacion actual adicional:

- `conversation.is_project_opportunity` se calcula en backend
- `definitions.familias` expone el catalogo resumido de familias
- `definitions.opportunity_kind` expone `project` o `generic`
- `solicitud_actual` se adjunta al contexto si existe

## Contrato del orquestador

Interfaz actual:

```python
class AgentTurnOrchestrator:
    async def process_turn(self, command: ProcessTurnCommand) -> dict:
        ...
```

### Fases internas del orquestador

1. cargar mensaje objetivo
2. validar idempotencia
3. resolver modalidad efectiva
4. diferir si `trigger=webhook` y modo `manual`
5. construir contexto
6. despachar a proceso activo o candidato
7. persistir nuevo estado
8. enviar respuesta saliente o devolver preview segun corresponda
9. registrar auditoria del turno

## Contrato comun de procesos

Cada proceso implementa una interfaz comun.

Interfaz actual:

```python
class AgentProcessHandler(Protocol):
    process_name: str

    def can_activate(self, context: ChatTurnContext) -> ProcessActivationDecision:
        ...

    def handle_turn(self, context: ChatTurnContext) -> ProcessTurnResult:
        ...
```

## Contrato de activacion de proceso

Resultado:

```json
{
  "can_activate": true,
  "priority": 90,
  "reason": "detecta pedido de materiales",
  "process_name": "solicitud_materiales"
}
```

### Uso

- permite resolver varios procesos candidatos
- evita codificar el despacho como logica monolitica
- documenta por que se eligio un proceso

## Contrato de resultado de proceso

Cada proceso devuelve una salida uniforme.

Modelo:

```json
{
  "process_name": "solicitud_materiales",
  "consumed_turn": true,
  "keep_process_active": true,
  "next_substate": "completa_atributos",
  "updated_process_state": {},
  "actions": [],
  "user_reply": {
    "text": "Que tipo de cemento necesitas?"
  },
  "handoff": null,
  "warnings": []
}
```

### Campos

- `process_name`: nombre del proceso que devolvio el resultado
- `consumed_turn`: indica si el proceso consumio el turno
- `keep_process_active`: indica si sigue como proceso activo
- `next_substate`: subestado resultante
- `updated_process_state`: nuevo estado persistible del proceso
- `actions`: acciones de negocio a aplicar
- `user_reply`: respuesta textual opcional producida por el agente
- `handoff`: opcion de derivar el turno a otro proceso o al flujo general
- `warnings`: observaciones no fatales
- `response_payload`: payload funcional devuelto al caller
- `debug`: metadata tecnica de prompts usados u otra auditoria

La decision de enviar o no `user_reply` no pertenece al proceso. Pertenece al
orquestador segun `delivery_mode`.

## Modelo de acciones de negocio

Las acciones son estructuradas y no implicitas.

Ejemplos usados hoy:

- `add_item`
- `update_item`
- `remove_item`
- `clear_request`
- `confirm_request`
- `set_pending_query`
- `clear_pending_query`
- `send_reply`
- `close_process`

Formato:

```json
{
  "type": "add_item",
  "payload": {}
}
```

## Handoff o reencauzado

El resultado del proceso puede indicar que el turno debe salir del proceso
actual.

Formato:

```json
{
  "target": "general_dispatch",
  "reason": "mensaje independiente respecto de consulta pendiente"
}
```

Estado actual:

- el contrato existe
- `solicitud_materiales` ya emite `handoff` en auditoria
- el orquestador todavia no re-despacha a un segundo proceso en la misma
  ejecucion

## Estrategia de prompts

Los prompts no deben estar centralizados en uno solo.

Se separan por:

- proceso
- tipo de turno
- objetivo de interpretacion

### Implementacion actual para `solicitud_materiales`

- `processes/solicitud_materiales/prompts/normal_turn.txt`
- `processes/solicitud_materiales/prompts/pending_attribute_turn.txt`

### Regla tecnica

El backend decide que prompt usar segun:

- proceso activo
- subestado
- resultado de validaciones deterministicas previas

## Puertos del LLM

Interfaz actual:

```python
class LLMGateway(Protocol):
    def interpret_normal_turn(self, context: ChatTurnContext, prompt_families: list[dict]) -> NormalTurnDecision:
        ...

    def classify_pending_turn(self, context: ChatTurnContext, pending_item: MaterialItem, pending_attribute: dict) -> PendingTurnDecision:
        ...
```

### Regla

El proceso nunca trabaja con texto crudo del modelo sin parseo y validacion.

Siempre existe:

- parseo estructurado
- validacion de campos obligatorios
- defaults o errores controlados

## Adaptadores de canal

El orquestador no conoce detalles de Meta WhatsApp ni de otros canales.

Interfaz actual:

```python
class OutboundChannelAdapter(Protocol):
    async def send_text(self, session: Session, command: SendTextCommand) -> SendResult:
        ...
```

### Beneficio

- desacopla el agente del proveedor de canal
- facilita testeo
- permite sumar email u otros canales

## Idempotencia

La automatizacion debe impedir reprocesar un mismo mensaje entrante.

### Regla minima

No procesar un turno si:

- `message_id` ya es igual a `last_processed_message_id`
- o existe un registro de ejecucion previa para ese mensaje

### Consideracion para `preview_only`

Si un turno ya fue procesado en `preview_only`, una nueva invocacion manual del
mismo turno no reprocesa por defecto.

El backend puede:

- devolver el preview persistido
- o exigir un `force_reprocess` explicito

El envio posterior del mensaje al canal no vuelve a ejecutar el agente.
Reutiliza la salida ya generada.

### Bitacora actual

Ubicacion local:

- `backend/agente/v2/core/state/turn_executions/oportunidad_{id}/message_{id}.json`

## Concurrencia

Implementacion actual:

- control de version optimista sobre estado persistido

No existe hoy:

- lock externo por oportunidad
- reintento automatico por conflicto

## Trazabilidad

Cada turno deja auditado:

- mensaje objetivo
- modalidad efectiva
- `trigger`
- `delivery_mode`
- proceso elegido
- subestado inicial y final
- prompts usados
- acciones aplicadas
- respuesta generada
- respuesta enviada, si existio
- warnings
- errores

La auditoria se guarda en:

- bitacora de ejecucion por turno
- `metadata_json.agent_v2` del `crm_mensaje`

## Flujo tecnico manual

1. se registra el mensaje entrante
2. el webhook delega al mismo orquestador con `trigger=webhook`
3. si el modo efectivo es `manual`, el orquestador devuelve `agent_deferred`
4. una accion explicita llama al mismo orquestador con `trigger=manual_button`
5. esa llamada usa `delivery_mode=preview_only` o `auto_send`
6. el backend procesa el mismo turno y persiste el mismo resultado de negocio

## Flujo tecnico automatico

1. se registra el mensaje entrante
2. el webhook llama al mismo orquestador con `trigger=webhook`
3. esa llamada usa `delivery_mode=auto_send`
4. el orquestador procesa el turno
5. si hay `user_reply`, se usa el adaptador de canal
6. se persiste el resultado del turno

## Integracion actual con WhatsApp

Para el caso actual:

- el webhook sigue siendo el punto de entrada del mensaje entrante
- la automatizacion se dispara con `message_id`, no por `oportunidad_id`
- el envio de mensajes reutiliza el adaptador del canal
- `Respuesta IA` invoca el mismo backend con `trigger=manual_button`
- `Auto responder` invoca el mismo backend con `delivery_mode=auto_send`
- la vista de solicitud lee la solicitud persistida sin reprocesar el turno

## Suite minima de pruebas

### Orquestador

- procesa mensaje nuevo
- difiere webhook en modo `manual`
- persiste cambio de proceso activo
- envia salida cuando corresponde
- devuelve preview cuando `delivery_mode=preview_only`
- no reejecuta el agente al reenviar un preview ya generado

### Registry y despacho

- prioriza proceso activo
- inicia proceso correcto segun candidatos
- resuelve `requested_process`

### Proceso `solicitud_materiales`

- alta de item
- completamiento de atributos
- reencauzado por mensaje independiente
- revision y cierre
- cantidad obligatoria por linea

### Canal

- salida exitosa
- no envio cuando no corresponde

## Estructura actual de modulos

```text
backend/agente/v2/
  core/
    orchestrator.py
    context_loader.py
    process_registry.py
    state_repository.py
    runtime.py
    contracts.py
    models.py
    state/
      conversation_state/
      material_requests/
      turn_executions/
  processes/
    solicitud_materiales/
      handler.py
      llm_client.py
      operation_execution.py
      request_validation.py
      request_store.py
      attribute_mapping.py
      family_catalog.py
      prompts/
        normal_turn.txt
        pending_attribute_turn.txt
      knowledge/
        familias_materiales.json
  infrastructure/
    channels/
      crm_channel_adapter.py
  shared/
    text_normalization.py
```

## Decision de diseno

La implementacion modela el agente como:

- un orquestador comun
- procesos enchufables
- estado persistido por conversacion
- prompts y reglas por proceso

No debe modelarse como:

- un endpoint unico con logica mezclada
- una cadena creciente de condiciones sin interfaz comun
- un flujo dependiente del frontend para mantener estado

## Resumen tecnico

La unidad de ejecucion del agente es el turno identificado por `message_id`.

El backend:

- resuelve la modalidad
- construye contexto
- selecciona proceso
- ejecuta el proceso
- persiste el nuevo estado
- envia respuesta si corresponde

Cada proceso:

- define activacion
- interpreta el turno en su dominio
- devuelve acciones estructuradas
- mantiene o cierra su estado

El proceso `solicitud_materiales` implementa ese contrato comun y agrega estado
conversacional propio para guiar la revision y el cierre de la solicitud.
