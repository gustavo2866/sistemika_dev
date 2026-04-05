# Core del Agente V2

## Objetivo

`core/` es el framework comun del agente.

No contiene la logica de negocio de un proceso concreto. Su responsabilidad es:

- tomar un turno a partir de un `message_id`
- cargar contexto base
- elegir el proceso aplicable
- delegar la ejecucion
- persistir estado y auditoria
- devolver el resultado al caller

## Divisiones funcionales

- `orchestrator.py`
  Coordina el pipeline del turno.
- `context_loader.py`
  Construye el contexto base a partir del mensaje y la oportunidad.
- `processes.py`
  Reune el contrato de proceso, los modelos de activacion y el `ProcessRegistry`.
- `turn.py`
  Reune los modelos del turno, la auditoria, la cache y la persistencia del pipeline.
- `state.py`
  Reune el estado conversacional global y su persistencia JSON.
- `runtime.py`
  Resuelve si el webhook debe disparar o no al agente.
- `delivery.py`
  Helper que usan los callers externos cuando deciden enviar la respuesta.
- `contracts.py`
  Define los puertos compartidos para store y canal.

## Flujo

Ejemplo: entra un mensaje y el sistema recibe su `message_id`.

1. `orchestrator.py` carga el mensaje objetivo.
2. `context_loader.py` arma el contexto base: mensaje, oportunidad, historial, estado global y runtime.
3. `processes.py` resuelve que proceso aplica.
4. El proceso elegido ejecuta su logica y devuelve un `ProcessTurnResult`.
5. `turn.py` guarda estado, auditoria y metadata del turno.
6. El orquestador devuelve el resultado final del turno.

## Que no hace

- no interpreta lenguaje natural
- no decide reglas de negocio de `solicitud_materiales`
- no carga estado especifico de un proceso antes del despacho
- no conoce prompts ni catalogos de un proceso
- no decide si la respuesta se envia o se muestra en UI

## Persistencia actual

El `core` consume el contrato `ConversationStateStore`.

Hoy la implementacion concreta esta en `state.py` como `JsonConversationStateStore`.

Persistencia local:

- `state/conversation_state/`
  estado global por oportunidad
- `state/turn_executions/`
  bitacora por mensaje procesado

## Regla de diseno

Si un artefacto sirve para cualquier proceso, pertenece a `core/`.

Si un artefacto existe solo para un proceso de negocio, no debe entrar en `core/`.
