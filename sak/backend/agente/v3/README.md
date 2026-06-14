# Agente V3

Runtime activo del agente para WhatsApp/channel.

## Organizacion

- `app.modules.channels.v3.meta_channel`: recepcion de payloads Meta, normalizacion, transcripcion de audio y encolado. El POST agenda persistencia asincronica en `channel_events` con `BackgroundTasks`, sin crear otra cola. El envio usa `channel_gateway.enviar_mensaje(..., policy="text_only")`.
- `contracts.py`: contratos compartidos del pipeline v3.
- `inbox/`: capa 01-inbox. Cola FIFO en memoria de mensajes recibidos.
- `orchestrator/`: capa 02-orquestador. Contexto conversacional, selector de subproceso y servicio de orquestacion.
- `subprocesses/`: capa 03-sub-proceso. Contrato, registro y subprocesos `general`, `pedidoObra` y `parteDiario`.
- `outbox/`: capa 04-outbox. Cola FIFO en memoria de respuestas pendientes.
- `llm/`: infraestructura compartida para integraciones LLM y Agent SDK.
- `runtime.py`: ejecuta una vuelta completa `inbox -> outbox`.

`pedidoObra` ya tiene una implementacion minima por etapas:

- `carga`: interpreta comandos `FIN` / `SALIR` y aplica operaciones locales sobre materiales.
- `validacion`: consulta datos obligatorios pendientes.
- `confirmar_salida`: confirma descarte con `VOLVER` / `CONFIRMAR`.
- `cierre`: pide confirmacion final con `CONFIRMAR`, permite `VOLVER` o `SALIR`.
- `finalizado`: cierra el subproceso.

## Integracion LLM

La infraestructura comun vive en `llm/`:

- `openai_chat_client.py`: llamada tecnica a OpenAI Chat, API key, modelo, JSON estructurado y errores.
- `prompt_loader.py`: carga/cache de prompts y serializacion JSON compacta.
- `agent_sdk_client.py`: wrapper reutilizable para OpenAI Agent SDK.

Cada subproceso conserva su propio `llm_client.py` porque ahi define que prompt usar, que contexto enviar, que schema esperar y como convertir el JSON recibido en operaciones internas.

## Secuencia

1. `app.modules.channels.v3.meta_channel.receive()` recibe Meta, transcribe audios si corresponde y encola `V3InboundMessage` en inbox.
2. `inbox.process_pending()` procesa la cola y llama al orquestador.
3. `orchestrator.process_message()` carga/crea contexto por `conversation_id`.
4. Si no hay `active_process`, el selector elige `general`, `pedidoObra` o `parteDiario`.
5. El subproceso devuelve contexto actualizado + respuesta.
6. El orquestador guarda contexto y encola `V3OutboundMessage` en outbox.
7. `outbox.process_pending()` procesa respuestas pendientes.
8. `app.modules.channels.v3.meta_channel.send_text()` realiza el envio real de la respuesta por channel.

## Endpoints

- `POST /api/agente/v3/channel/meta`: recibe un webhook raw de Meta y encola mensajes inbound.
- `POST /api/agente/v3/inbox/process?limit=10`: procesa mensajes pendientes de la cola.
- `GET /api/agente/v3/inbox/status`: muestra mensajes recibidos pendientes y procesados.
- `POST /api/agente/v3/outbox/process?limit=10`: procesa respuestas pendientes de envio.
- `GET /api/agente/v3/outbox/status`: muestra respuestas pendientes y ultimo envio registrado.
- `GET /api/agente/v3/context/status`: muestra contextos conversacionales en memoria.
- `POST /api/agente/v3/inbox/reset`: limpia la memoria v3 para repetir una prueba.

El runtime v3 es el unico flujo activo para el agente WhatsApp/channel.
