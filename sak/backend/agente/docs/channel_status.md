# Estado conversacional del agente y resolucion de contexto

## Objetivo

Documentar el funcionamiento actual del estado conversacional del agente y el
cambio propuesto para soportar mensajes que inicialmente no tienen una
`oportunidad_id` resuelta.

La oportunidad sigue siendo el concepto correcto para representar "lo que se
esta gestionando": alquiler, venta, reparacion, cobranza, proyecto de
construccion, etc. El problema puntual es anterior: en algunos mensajes todavia
no se sabe a que oportunidad corresponde la conversacion.

## Funcionamiento actual

Hoy los mensajes entrantes se persisten en `crm_mensajes`.

El flujo principal de WhatsApp/Meta esta en `MetaWebhookService`:

1. Se busca o crea el contacto.
2. Se resuelve o crea una oportunidad CRM.
3. Se crea el `CRMMensaje` con `oportunidad_id`.
4. Se ejecuta el agente usando esa oportunidad como contexto.

El estado conversacional del agente se guarda en:

```text
agente_conversation_states
```

Modelo actual:

```text
oportunidad_id            PK, FK crm_oportunidades.id
active_process
process_state
last_message_id
last_outbound_message_id
version
updated_at
```

Por diseno actual, hay una sola fila de estado por oportunidad.

El orquestador tambien exige oportunidad:

```text
CRMMensaje.oportunidad_id debe estar informado
```

Si el mensaje no tiene oportunidad, el turno del agente no se procesa.

## Problema

El estado conversacional esta usando `oportunidad_id` como identidad primaria.
Eso funciona cuando el contacto participa en una sola gestion abierta.

No funciona bien cuando un contacto de tipo especial participa en mas de una
gestion abierta. Ejemplos:

- un encargado administra mas de un proyecto;
- un inquilino puede tener mas de una gestion abierta.

En esos casos:

- el contacto esta identificado;
- hay varias oportunidades posibles;
- el mensaje todavia no permite saber a cual corresponde;
- pueden llegar varios mensajes antes de resolver el contexto.

No conviene inventar una oportunidad generica. Lo correcto es mantener un
estado conversacional pendiente y, cuando se resuelva el contexto, asociar los
mensajes a la oportunidad real.

## Observacion importante

`CRMMensaje.oportunidad_id` ya permite `null` a nivel modelo.

El bloqueo actual no esta en la columna sino en el flujo:

- el webhook resuelve o crea oportunidad antes de guardar el mensaje;
- el orquestador rechaza mensajes sin oportunidad;
- `agente_conversation_states` usa `oportunidad_id` como primary key.

## Idea central del cambio

`agente_conversation_states` debe tener identidad propia.

En lugar de usar `oportunidad_id` como primary key, debe usar un `id` propio y
permitir que `oportunidad_id` sea nullable.

Luego `crm_mensajes` debe poder referenciar ese estado conversacional.

Modelo objetivo:

```text
agente_conversation_states
- id                         PK
- oportunidad_id             nullable, FK crm_oportunidades.id
- contacto_id                nullable, FK crm_contactos.id
- canal                      nullable
- celular_id                 nullable
- estado_contexto            resolved | pending_context | pending_verification | closed | cancelled
- active_process
- process_state
- last_message_id
- last_outbound_message_id
- version
- created_at
- updated_at
- resolved_at                nullable
```

Y en mensajes:

```text
crm_mensajes
- conversation_state_id      nullable, FK agente_conversation_states.id
- oportunidad_id             nullable, FK crm_oportunidades.id
```

Esto permite agrupar varios mensajes bajo el mismo estado conversacional,
incluso antes de saber a que oportunidad corresponden.

## Flujo propuesto por tipo de contacto

El comportamiento depende del tipo de contacto.

Tipos especiales:

```text
encargado
inquilino
```

Estos contactos representan personas que normalmente ya existen en el sistema
porque estan vinculadas a una gestion concreta.

Importante: el flujo especial solo puede aplicarse despues de recuperar un
contacto existente y leer su tipo. Si no se encuentra el contacto, todavia no
hay forma de saber que era `encargado` o `inquilino`; por lo tanto aplica el
flujo de contactos no especiales.

### Contactos no especiales

Aplica para contactos que no son `encargado` ni `inquilino`.

1. Llega mensaje por channel.
2. Se recupera el `contacto_id` por referencia externa o se crea un contacto
   nuevo.
3. Se busca una oportunidad abierta asociada al contacto.
4. Si existe una oportunidad abierta, se usa esa oportunidad.
5. Si no existe una oportunidad abierta, se crea una oportunidad nueva en estado
   `prospect`.
6. Se crea o reutiliza `agente_conversation_states` con:

```text
oportunidad_id = oportunidad resuelta
estado_contexto = resolved
contacto_id = contacto
canal / celular_id = origen del mensaje
```

7. Se crea `CRMMensaje` con:

```text
conversation_state_id = estado conversacional
oportunidad_id = oportunidad resuelta
```

8. El agente sigue el flujo normal.

### Contactos especiales con una sola oportunidad abierta

Aplica para contactos tipo `encargado` o `inquilino`.

1. Llega mensaje por channel.
2. Se recupera el `contacto_id`.
3. Se verifica que el tipo del contacto sea `encargado` o `inquilino`.
4. Se buscan oportunidades abiertas asociadas al contacto.
5. Si existe una sola oportunidad abierta, se usa esa oportunidad.
6. Se crea o reutiliza `agente_conversation_states` con:

```text
oportunidad_id = oportunidad resuelta
estado_contexto = resolved
contacto_id = contacto
canal / celular_id = origen del mensaje
```

7. Se crea `CRMMensaje` con:

```text
conversation_state_id = estado conversacional
oportunidad_id = oportunidad resuelta
```

8. El agente sigue el flujo normal.

### Contactos especiales con mas de una oportunidad abierta

Aplica para contactos tipo `encargado` o `inquilino` cuando tienen mas de una
oportunidad abierta.

1. Llega mensaje por channel.
2. Se recupera el `contacto_id`.
3. Se verifica que el tipo del contacto sea `encargado` o `inquilino`.
4. Se detectan varias oportunidades abiertas.
5. Se crea o reutiliza `agente_conversation_states` con:

```text
oportunidad_id = null
estado_contexto = pending_context
contacto_id = contacto
canal / celular_id = origen del mensaje
```

6. Se crea `CRMMensaje` con:

```text
conversation_state_id = estado pendiente
oportunidad_id = null
```

7. El agente no ejecuta acciones de negocio.
8. El agente consulta por la oportunidad correspondiente. En el caso de
   proyectos, consulta por la obra/proyecto.
9. Si llegan mas mensajes antes de resolver el contexto, se asocian al mismo
   `conversation_state_id`.
10. Cuando el usuario indica la oportunidad, se resuelve el contexto.
11. Se actualiza el estado:

```text
agente_conversation_states.oportunidad_id = oportunidad resuelta
estado_contexto = resolved
resolved_at = now
```

12. Se actualizan los mensajes pendientes del estado:

```text
crm_mensajes.oportunidad_id = oportunidad resuelta
where conversation_state_id = estado
  and oportunidad_id is null
```

13. Recien entonces se ejecuta el proceso de negocio, por ejemplo `pedido_obra`.

### Contactos especiales sin oportunidad abierta

Aplica para contactos tipo `encargado` o `inquilino` sin oportunidades abiertas.

Este caso no debe crear automaticamente una oportunidad `prospect`, porque para
estos tipos el contacto deberia estar relacionado a una gestion existente.

Flujo recomendado:

1. Registrar el mensaje con `conversation_state_id`.
2. Dejar `oportunidad_id = null`.
3. Marcar `estado_contexto = pending_verification`.
4. Derivar a verificacion manual o responder con un mensaje controlado.

## Pedido abierto

Hoy el pedido abierto no se busca en `constructora_pedidos`.

El proceso `pedido_obra` considera que hay pedido activo por el estado
conversacional:

```text
process_state.items no vacio
etapa in ("carga", "confirmacion")
```

Con el nuevo modelo, ese estado seguiria viviendo en
`agente_conversation_states.process_state`, pero ya no estaria obligado a estar
identificado por `oportunidad_id`.

Antes de resolver la oportunidad, el estado puede contener solo la etapa de
resolucion de contexto. Despues de resolverla, puede continuar con el estado
normal del proceso `pedido_obra`.

## Reglas de negocio

- Para contactos no especiales, si no hay oportunidad abierta se puede crear una
  oportunidad nueva en estado `prospect`.
- El flujo especial para `encargado` o `inquilino` solo aplica si el contacto
  existente fue identificado y su tipo fue leido.
- Para contactos tipo `encargado` o `inquilino`, si hay mas de una oportunidad
  abierta se debe resolver contexto antes de ejecutar procesos de negocio.
- `CRMMensaje.oportunidad_id` puede ser `null` mientras el contexto este
  pendiente.
- `CRMMensaje.conversation_state_id` agrupa los mensajes de una misma
  conversacion/estado del agente.
- No se debe crear `ConstructoraPedido` sin oportunidad real.
- No se debe crear una oportunidad generica para resolver ambiguedad.
- La oportunidad se asigna cuando haya contexto suficiente.
- Al resolver contexto, pueden actualizarse varios mensajes, no solo el ultimo.
- El cierre de la conversacion no es el disparador principal de sincronizacion;
  la sincronizacion ocurre cuando se resuelve la oportunidad.

## Plan de cambios

### 1. Migracion de `agente_conversation_states`

Cambiar la tabla para que tenga `id` como PK.

Pasos sugeridos:

1. Agregar columna `id` autoincremental.
2. Backfill de `id` para filas existentes.
3. Cambiar PK de `oportunidad_id` a `id`.
4. Mantener `oportunidad_id` como FK nullable.
5. Agregar columnas:

```text
contacto_id
canal
celular_id
estado_contexto
created_at
resolved_at
```

6. Agregar indices:

```text
idx_agente_conversation_states_oportunidad_id
idx_agente_conversation_states_contacto_context
idx_agente_conversation_states_estado_contexto
```

### 2. Migracion de `crm_mensajes`

Agregar:

```text
conversation_state_id nullable FK agente_conversation_states.id
```

Backfill sugerido:

```text
para cada crm_mensaje con oportunidad_id:
  buscar agente_conversation_states por oportunidad_id
  asignar conversation_state_id
```

### 3. Ajustar modelos SQLModel

Actualizar:

- `AgentConversationState`
- `CRMMensaje`

`AgentConversationState` debe dejar de usar `oportunidad_id` como PK.

`CRMMensaje` debe incluir relacion opcional a `AgentConversationState`.

### 4. Ajustar `DbConversationStateStore`

Hoy carga/guarda por `oportunidad_id`.

Debe soportar:

```text
load_by_id(conversation_state_id)
load_or_create_for_oportunidad(oportunidad_id)
load_or_create_pending_context(contacto_id, canal, celular_id)
resolve_context(conversation_state_id, oportunidad_id)
```

Durante la transicion se puede mantener compatibilidad con `load(oportunidad_id)`
para endpoints existentes.

### 5. Ajustar ingreso de mensajes en `MetaWebhookService`

Cambiar el orden actual.

Hoy:

```text
contacto -> oportunidad -> mensaje -> agente
```

Nuevo:

```text
contacto -> evaluar tipo de contacto -> resolver contexto -> conversation_state -> mensaje -> agente/resolucion
```

Reglas:

- Contacto no especial: puede crear contacto y oportunidad `prospect`.
- Contacto especial: se determina solo si el contacto existente fue
  identificado y su tipo fue leido.
- Contacto especial con una oportunidad abierta: resuelve oportunidad y sigue.
- Contacto especial con varias oportunidades abiertas: crea mensaje y estado sin
  oportunidad.
- Contacto especial sin oportunidad abierta: queda en `pending_verification`.

### 6. Ajustar `AgentTurnOrchestrator`

Hoy rechaza mensajes sin oportunidad.

Debe permitir dos modos:

```text
modo resolved:
  oportunidad_id informado
  procesa negocio normalmente

modo pending_context:
  oportunidad_id null
  solo ejecuta proceso de resolucion de contexto
```

El proceso de resolucion debe preguntar por la obra/proyecto y resolver el
`conversation_state_id`.

### 7. Agregar proceso de resolucion de contexto

Nuevo proceso conceptual:

```text
context_resolution
```

Responsabilidades:

- listar oportunidades/proyectos abiertos del contacto;
- preguntar a cual corresponde;
- interpretar respuesta del usuario;
- resolver `conversation_state_id`;
- actualizar mensajes pendientes;
- delegar luego al proceso normal.

### 8. Proteger procesos de negocio

Procesos como `pedido_obra` deben seguir exigiendo oportunidad real.

Regla:

```text
si oportunidad_id es null:
  no crear pedido
  no ejecutar acciones operativas
```

### 9. Ajustar endpoints por oportunidad

Los endpoints existentes `/chat/{oportunidad_id}` pueden mantenerse.

Para mensajes pendientes de contexto conviene agregar endpoints separados,
por ejemplo:

```text
/crm/mensajes/contexto-pendiente
/crm/mensajes/conversation-state/{id}
```

Esto evita forzar una oportunidad donde todavia no existe.

### 10. Tests

Casos minimos:

1. Contacto no especial sin oportunidad abierta: crea contacto/oportunidad
   segun corresponda y procesa normal.
2. Referencia externa sin contacto existente: aplica flujo general porque no se
   puede conocer el tipo de contacto.
3. Contacto especial con una oportunidad abierta: asigna oportunidad y procesa
   normal.
4. Contacto especial con dos oportunidades abiertas: crea mensaje sin
   oportunidad y con `conversation_state_id`.
5. Segundo mensaje ambiguo: se agrupa en el mismo `conversation_state_id`.
6. Respuesta seleccionando obra: actualiza estado y todos los mensajes
   pendientes.
7. Pedido de obra no se crea antes de resolver oportunidad.
8. Pedido de obra se crea luego de resolver oportunidad.

## Resultado esperado

El estado conversacional queda desacoplado de la PK de oportunidad, pero sigue
permitiendo que la oportunidad sea el contexto de negocio cuando este resuelta.

Esto conserva el modelo conceptual de CRM como gestion abstracta y, al mismo
tiempo, permite manejar conversaciones donde el contexto todavia esta pendiente.
