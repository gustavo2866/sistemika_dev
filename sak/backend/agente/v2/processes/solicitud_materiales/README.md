# Proceso: solicitud_materiales

Proceso conversacional del agente v2 que permite armar, editar y confirmar una solicitud de materiales de construcción a través del chat.

## Responsabilidades

- Detectar cuando un mensaje es una solicitud de materiales (heurística o LLM)
- Mantener el estado de la solicitud entre turnos
- Completar atributos obligatorios de cada ítem mediante diálogo guiado
- Ejecutar operaciones sobre la solicitud: agregar, modificar, eliminar, confirmar
- Manejar mensajes fuera de contexto durante el diálogo sin perder el hilo

---

## Estructura del módulo

```
solicitud_materiales/
├── handler.py               # Punto de entrada — implementa AgentProcess
├── models.py                # Dataclasses: MaterialItem, MaterialRequestState, contextos, decisiones LLM
├── llm_client.py            # Llamadas a OpenAI: interpret_normal_turn, classify_pending_turn, reply_independent_during_pending
├── family_catalog.py        # Catálogo de familias de materiales con atributos obligatorios
├── request_store.py         # Persistencia JSON local de la solicitud por oportunidad
├── request_validation.py    # Evalúa ítems, detecta faltantes y formula preguntas pendientes
├── operation_execution.py   # Aplica operaciones LLM (add/update/remove/confirm/clear) sobre MaterialRequestState
├── attribute_mapping.py     # Mapeo directo sin LLM: números, enums, strings
├── knowledge/
│   └── familias_materiales.json   # Definición de familias (cementicios, acero, áridos, etc.)
└── prompts/
    ├── normal_turn.txt              # Prompt: interpretar turno normal de solicitud
    ├── pending_attribute_turn.txt   # Prompt: clasificar respuesta cuando hay atributo pendiente
    └── independent_during_pending.txt  # Prompt: responder mensaje ajeno durante consulta pendiente
```

---

## Flujo principal

### Entrada al proceso

`ConversationAgentV2` implementa el protocolo `AgentProcess` del core v2:

```
priority(ctx) → int | None
    None        si la oportunidad no tiene proyecto
    100 + 1000  si ya es el proceso activo (bonus del registry)
    90          si existe solicitud activa sin proceso marcado
    80          si el mensaje coincide heurísticamente (_MATERIAL_VERBS / _MATERIAL_PATTERN)
    10          fallback conversacional para proyectos sin solicitud

handle(ctx) → TurnResult
    → handle_turn(MaterialRequestTurnContext)
```

### Turno normal (sin consulta pendiente)

```
handle_turn()
    └─ interpret_normal_turn (LLM)
            ├─ "smalltalk" / "no_op"  → respuesta contextual
            │                           si hay solicitud abierta → anexa estado actual
            │
            └─ "request_operation"    → OperationExecutor.apply()
                                        → RequestValidator.refresh()
                                        → ¿atributos faltantes? → formula próxima pregunta
```

### Turno con consulta pendiente

```
handle_turn()
    └─ ¿active_query_item?  →  SÍ
            │
            ├─ DirectAttributeMapper.try_map()
            │       → match directo (número, enum, string)  → aplica valor → continúa
            │
            └─ classify_pending_turn (LLM)
                    ├─ "answer_attempt" / "ambiguous"
                    │       → re-pregunta (consulta_intentos += 1)
                    │
                    └─ "independent_message"
                            └─ interpret_normal_turn (LLM)
                                    ├─ "request_operation"
                                    │       → _process_normal_decision() (path normal)
                                    │
                                    └─ "smalltalk" / "no_op"
                                            → reply_independent_during_pending (LLM)
                                              responde al mensaje + retoma la pregunta pendiente
```

---

## Modelos clave

### `MaterialItem`
Representa un ítem de la solicitud.

| Campo | Descripción |
|---|---|
| `item_id` | UUID único |
| `descripcion` | Texto libre del ítem |
| `cantidad` | Número o None si no se indicó |
| `unidad` | bolsas, barras, m3, etc. |
| `familia` | Código de familia del catálogo |
| `atributos` | Dict con atributos específicos (tipo, largo_m, diametro_mm, etc.) |
| `faltantes` | Lista de atributos obligatorios aún sin valor |
| `consulta` | Pregunta formulada al usuario para el atributo pendiente |
| `consulta_atributo` | Nombre del atributo que se está completando |
| `consulta_intentos` | Contador de intentos fallidos |

### `MaterialRequestState`
Estado completo de la solicitud persistida por oportunidad.

| Campo | Descripción |
|---|---|
| `oportunidad_id` | ID de la oportunidad CRM |
| `activa` | False cuando se confirma o cancela |
| `estado_solicitud` | `draft` → `ready` → `confirmed` |
| `items` | Lista de `MaterialItem` |
| `version` | Se incrementa en cada guardado |

### `MaterialRequestProcessState`
Estado de proceso guardado en `ConversationState.process_state`. Persiste entre turnos.

| Campo | Descripción |
|---|---|
| `pending_query` | Consulta activa (item_id, atributo, texto, intentos) |
| `last_user_intent` | Última intención detectada |
| `last_agent_prompt` | Última respuesta del agente |
| `awaiting_user_decision` | `continue_or_close` cuando la solicitud está lista |
| `ready_for_confirmation` | True cuando todos los ítems están completos |

---

## Catálogo de familias

Definido en `knowledge/familias_materiales.json`. Cada familia tiene:
- `codigo`: identificador único (ej: `cementicios`, `acero_refuerzo`, `aridos`)
- `nombre` y `tags`: usados por el LLM para clasificar los ítems
- `atributos`: lista de atributos con tipo, valores posibles y si son obligatorios

El catálogo se carga con `FamilyCatalog` y se pasa al LLM como contexto en cada turno.

---

## Prompts LLM

### `normal_turn.txt`
Determina la intención del turno. Devuelve:
- `smalltalk` — mensaje social, sin operación
- `no_op` — mensaje sin efecto sobre la solicitud
- `request_operation` — lista de operaciones: `add`, `update`, `remove`, `confirm_request`, `clear_request`, `show_request`

### `pending_attribute_turn.txt`
Evalúa si el mensaje es una respuesta al atributo pendiente. Devuelve:
- `answer_attempt` — intentó responder (se re-pregunta si no se pudo mapear)
- `ambiguous` — no queda claro (se re-pregunta)
- `independent_message` — mensaje ajeno a la consulta (se deriva a `interpret_normal_turn`)

### `independent_during_pending.txt`
Usado cuando el mensaje es `independent_message` y `interpret_normal_turn` devuelve `smalltalk`/`no_op`. Genera una respuesta que:
1. Responde directamente al mensaje del usuario
2. Retoma la pregunta pendiente de forma natural

---

## Persistencia

La solicitud se guarda como JSON en disco:
```
agente/v2/core/state/material_requests/oportunidad_{id}.json
```

El estado de conversación (proceso activo, `process_state`) se guarda por separado en `JsonConversationStateStore` del core v2.

---

## Detección heurística

Antes de llamar al LLM, `priority()` evalúa si el mensaje parece una solicitud de materiales:

**Verbos detectados:** `necesito`, `manda`, `mandame`, `agrega`, `suma`, `saca`, `quita`, `cambia`, `corrige`, `deja solo`, `limpia`, `borra`, `reinicia`, `confirmo`

**Patrón numérico:** `\d+ (bolsas|barras|m3|metros|mts|unidades|rollos|kg)`

Si ninguno aplica, el proceso igual puede activarse con prioridad 10 como fallback conversacional para oportunidades con proyecto activo.

---

## Integración con el core v2

```python
from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from agente.v2.core.orchestrator import AgentTurnOrchestrator

state_store, agent = build_v2_dependencies()
orchestrator = AgentTurnOrchestrator(processes=[agent], state_store=state_store)
result = await orchestrator.process_turn(db_session, message_id, "webhook")
```
