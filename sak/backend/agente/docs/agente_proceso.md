# Agente de Proceso

## Objetivo

Este documento describe el flujo activo del agente conversacional de WhatsApp.

El agente recibe mensajes normalizados por el canal, conserva contexto por
conversacion, selecciona el subproceso que corresponde y delega el turno al
handler especializado.

## Artefactos Activos

- `backend/agente/v3/orchestrator/service.py`: orquestador principal.
- `backend/agente/v3/orchestrator/context_store.py`: estado conversacional.
- `backend/agente/v3/orchestrator/process_selector.py`: seleccion de proceso.
- `backend/agente/v3/subprocesses/registry.py`: registro de subprocesos.
- `backend/agente/v3/subprocesses/general.py`: menu y despacho general.
- `backend/agente/v3/subprocesses/pedido_obra/handler.py`: pedido de obra.
- `backend/agente/v3/subprocesses/parte_diario/handler.py`: parte diario.

## Flujo General

1. El canal recibe y normaliza el mensaje entrante.
2. El runtime carga o crea el contexto de la conversacion.
3. Si hay `active_process`, el orquestador conserva ese proceso.
4. Si no hay proceso activo, `process_selector` clasifica el mensaje.
5. El registry entrega el handler correspondiente.
6. El handler procesa el turno y devuelve contexto actualizado, respuesta y
   metadata.
7. El orquestador guarda el contexto y encola la respuesta saliente.

## Seleccion de Proceso

La regla central esta en `V3Orchestrator._resolve_process(...)`:

- si `context.active_process` existe, el siguiente mensaje vuelve a ese proceso;
- si no existe, se consulta el selector para iniciar `general`, `pedidoObra` o
  `parteDiario`.

Esto evita que un proceso activo pierda continuidad conversacional.

## Subprocesos

### General

`general` muestra el menu, responde mensajes generales y hace handoff hacia
otros subprocesos cuando el usuario elige una opcion.

### Pedido de Obra

`pedidoObra` administra la carga conversacional de pedidos de obra.

### Parte Diario

`parteDiario` administra la seleccion de obra, seleccion de fecha, carga de
novedades, validacion, guardado y cierre del parte diario.

El detalle operativo vigente esta en:

- `backend/agente/v3/subprocesses/parte_diario/README.md`

## Estado Conversacional

El contexto activo guarda:

- `active_process`: proceso que debe recibir el proximo mensaje.
- `process_state`: estado serializado del proceso activo.
- referencias del ultimo mensaje entrante y saliente.

Cada handler decide si mantiene el proceso activo, deriva a otro proceso o
limpia el contexto.

## Salida

El orquestador no envia directamente por proveedor. Encola mensajes outbound y
la capa de outbox/channel se ocupa del envio real.

## Documentacion Relacionada

- `backend/agente/v3/README.md`
- `backend/agente/v3/subprocesses/parte_diario/README.md`
- `backend/agente/docs/agente_tecnico.md`
