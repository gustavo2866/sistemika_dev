# Agente Tecnico

## Objetivo

Este documento resume la estructura tecnica activa del agente conversacional.

La documentacion funcional del flujo general esta en `agente_proceso.md`.

## Runtime Activo

El runtime activo vive bajo:

```text
backend/agente/v3/
```

El punto de entrada API esta en:

- `backend/app/routers/agente_v3_router.py`

## Componentes

### Contratos

- `backend/agente/v3/contracts.py`

Define los modelos compartidos para mensajes inbound, outbound, contexto,
resultado de proceso y resultado del orquestador.

### Orquestador

- `backend/agente/v3/orchestrator/service.py`

Responsabilidades:

- cargar contexto;
- resolver proceso destino;
- ejecutar el handler;
- procesar handoff interno cuando corresponde;
- guardar contexto actualizado;
- encolar respuestas salientes.

### Context Store

- `backend/agente/v3/orchestrator/context_store.py`

Persiste el contexto conversacional usado por el orquestador:

- `active_process`;
- `process_state`;
- ultimo mensaje entrante;
- ultimo mensaje saliente;
- metadata de debug.

### Selector de Proceso

- `backend/agente/v3/orchestrator/process_selector.py`

Clasifica mensajes sin proceso activo y decide entre:

- `general`;
- `pedidoObra`;
- `parteDiario`.

### Registry

- `backend/agente/v3/subprocesses/registry.py`

Registra los handlers disponibles y permite que el orquestador los resuelva por
nombre.

### Inbox y Outbox

- `backend/agente/v3/inbox/queue.py`
- `backend/agente/v3/outbox/queue.py`

Separan la recepcion del mensaje del envio de respuestas.

### Emisor

- `backend/agente/v3/emisor.py`

Permite que un subproceso emita mensajes adicionales sin acoplarse al canal.

## Subprocesos Activos

### General

- `backend/agente/v3/subprocesses/general.py`
- `backend/agente/v3/subprocesses/general_agent.py`
- `backend/agente/v3/subprocesses/general_fastpath.py`

Maneja menu, saludos y handoff hacia procesos especializados.

### Pedido de Obra

- `backend/agente/v3/subprocesses/pedido_obra/handler.py`
- `backend/agente/v3/subprocesses/pedido_obra/state.py`
- `backend/agente/v3/subprocesses/pedido_obra/interpreter.py`
- `backend/agente/v3/subprocesses/pedido_obra/llm_client.py`

### Parte Diario

- `backend/agente/v3/subprocesses/parte_diario/handler.py`
- `backend/agente/v3/subprocesses/parte_diario/state.py`
- `backend/agente/v3/subprocesses/parte_diario/process.py`
- `backend/agente/v3/subprocesses/parte_diario/executor.py`
- `backend/agente/v3/subprocesses/parte_diario/llm_client.py`
- `backend/agente/v3/subprocesses/parte_diario/carga_agent.py`
- `backend/agente/v3/subprocesses/parte_diario/query_agent.py`
- `backend/agente/v3/subprocesses/parte_diario/renderer.py`

## Reglas Tecnicas

- Un mensaje con proceso activo se enruta siempre a ese proceso.
- Un handler debe devolver un contexto actualizado explicito.
- El estado de proceso debe ser serializable.
- Los comandos locales se resuelven en el handler antes de usar LLM.
- La persistencia de negocio queda en servicios de aplicacion, no en el
  orquestador.
- El outbox es responsable de la entrega final al canal.

## Pruebas Relevantes

- `backend/tests/api/test_agente_v3.py`
- `backend/tests/unit/test_parte_diario_v3.py`
- `backend/tests/unit/test_parte_diario_persistence.py`
- `backend/tests/unit/test_parte_diario_llm_client.py`
