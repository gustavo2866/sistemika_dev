# Agente V2

## Estructura

- `core/`: framework general del agente, contratos y modelos comunes.
  Artefacto principal: `core/orchestrator.py`
  Persistencia local: `core/state/`
  Estado conversacional: `core/state/conversation_state/`
  Bitacora por turno: `core/state/turn_executions/`
- `processes/solicitud_materiales/`: implementacion completa del proceso de solicitud.
  Artefacto principal: `processes/solicitud_materiales/handler.py`
  Solicitudes persistidas: `core/state/material_requests/`
  Prompts: `processes/solicitud_materiales/prompts/`
  Knowledge: `processes/solicitud_materiales/knowledge/`
- `infrastructure/`: adaptadores externos reutilizables.
- `shared/`: utilidades transversales.

## Regla

- si un artefacto sirve para cualquier proceso, va en `core/`, `infrastructure/` o `shared/`
- si un artefacto existe solo para `solicitud_materiales`, va dentro de `processes/solicitud_materiales/`

## Flujo actual

- el webhook persiste el mensaje y delega siempre al orquestador
- el orquestador resuelve modalidad, contexto, proceso y entrega
- la modalidad global puede administrarse desde `settings` y CRM Setup, con fallback a `CRM_CHAT_AGENT_MODE`
- `solicitud_materiales` mantiene la solicitud y su estado conversacional
- la vista manual puede pedir `preview_only`, `auto_send` o abrir la solicitud ya persistida
