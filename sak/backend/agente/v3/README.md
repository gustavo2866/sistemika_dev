# Agente V3

Version experimental para medir el flujo paso a paso.

## Capas iniciales

- `channel.py`: recepcion de payloads Meta, normalizacion y encolado. El POST agenda persistencia asincronica en `channel_events` con `BackgroundTasks`, sin crear otra cola. El envio usa `channel_gateway.enviar_mensaje(..., policy="text_only")`.
- `inbox.py`: cola FIFO en memoria de mensajes recibidos. Procesa inbound y llama al orquesador.
- `context.py`: store en memoria de contexto conversacional por `conversation_id`.
- `process_selector.py`: selector inicial de subproceso cuando no existe `active_process`.
- `processes.py`: subprocesos v3. Cada subproceso recibe mensaje + contexto y devuelve contexto actualizado + respuesta.
- `orquesador.py`: orquesador minimo. Carga/crea contexto, deriva al subproceso, guarda contexto actualizado y encola respuesta en outbox.
- `outbox.py`: cola FIFO en memoria de respuestas pendientes. Procesa outbound y solicita envio al channel.

## Secuencia

1. `channel.receive()` recibe Meta y encola `V3InboundMessage` en inbox.
2. `inbox.process_pending()` procesa la cola y llama al orquesador.
3. `orquesador.process_message()` carga/crea contexto por `conversation_id`.
4. Si no hay `active_process`, el selector elige `general`, `pedidoObra` o `parteDiario`.
5. El subproceso devuelve contexto actualizado + respuesta.
6. El orquesador guarda contexto y encola `V3OutboundMessage` en outbox.
7. `outbox.process_pending()` procesa respuestas pendientes.
8. `channel.send_text()` realiza el envio real de la respuesta por channel.

## Endpoints

- `POST /api/agente/v3/channel/meta`: recibe un webhook raw de Meta y encola mensajes inbound.
- `POST /api/agente/v3/inbox/process?limit=10`: procesa mensajes pendientes de la cola.
- `GET /api/agente/v3/inbox/status`: muestra mensajes recibidos pendientes y procesados.
- `POST /api/agente/v3/outbox/process?limit=10`: procesa respuestas pendientes de envio.
- `GET /api/agente/v3/outbox/status`: muestra respuestas pendientes y ultimo envio registrado.
- `GET /api/agente/v3/context/status`: muestra contextos conversacionales en memoria.
- `POST /api/agente/v3/inbox/reset`: limpia la memoria v3 para repetir una prueba.

La v3 no reemplaza el flujo v2 ni sus workers. Es una ruta paralela para medir tiempos de recepcion, persistencia DB channel, cola, orquesador y envio simulado.
