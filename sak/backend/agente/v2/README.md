# Agente V2

## Estructura

- `core/`: framework general del agente, contratos y modelos comunes.
  Artefacto principal: `core/orchestrator.py`
  Flujo del turno: `core/turn.py`
  Estado conversacional: `core/state.py`
  Despacho entre procesos: `core/processes.py`
  Helper de envio para callers externos: `core/delivery.py`
  El `context_loader` construye solo contexto base generico
  El `context_loader` expone `state_store` como dependencia publica del orquestador
  El store conversacional se consume por interfaz; hoy usa JSON como implementacion concreta
  Persistencia local: `core/state/`
  Estado conversacional: `core/state/conversation_state/`
  Bitacora por turno: `core/state/turn_executions/`
- `processes/solicitud_materiales/`: implementacion completa del proceso de solicitud.
  Artefacto principal: `processes/solicitud_materiales/handler.py`
  Modelos del proceso: `processes/solicitud_materiales/models.py`
  Solicitudes persistidas: `core/state/material_requests/`
  Prompts: `processes/solicitud_materiales/prompts/`
  Knowledge: `processes/solicitud_materiales/knowledge/`
- `infrastructure/`: adaptadores externos reutilizables.
- `shared/`: utilidades transversales.

## Regla

- si un artefacto sirve para cualquier proceso, va en `core/`, `infrastructure/` o `shared/`
- si un artefacto existe solo para `solicitud_materiales`, va dentro de `processes/solicitud_materiales/`

## Flujo actual

- el webhook persiste el mensaje y solo delega al orquestador si la modalidad global es `automatic`
- el boton manual del chat puede invocar siempre al mismo orquestador
- el orquestador resuelve contexto base y proceso
- `turn.py` concentra los modelos del turno, la auditoria, la cache y la persistencia del pipeline
- el store JSON usa escritura atomica para estado conversacional y bitacora
- la modalidad global hoy es simple: `manual` o `automatic`; puede administrarse desde `settings` y CRM Setup, con fallback a `CRM_CHAT_AGENT_MODE`
- `solicitud_materiales` carga su propio contexto especifico despues del despacho y mantiene la solicitud con su estado conversacional
- el orquestador siempre devuelve el resultado al caller; el caller decide si lo muestra o lo envia
