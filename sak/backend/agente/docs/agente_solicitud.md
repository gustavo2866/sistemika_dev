# Proceso de Solicitud de Materiales

## Objetivo

Este documento define el proceso funcional de `solicitud_materiales`.

Describe como el backend y el LLM colaboran para administrar una solicitud de
materiales persistida, completar faltantes y conducir el dialogo hasta dejar la
solicitud lista para revision o confirmacion.

Este proceso debe entenderse como un modulo especifico dentro del marco general
definido en `agente_proceso.md`.

La especificacion tecnica base para implementar ese marco vive en
`agente_tecnico.md`.

## Ubicacion dentro del esquema general

Dentro del agente general, `solicitud_materiales` es un proceso conectable con
estado propio.

Su funcion es:

- interpretar mensajes relacionados con pedidos de materiales
- construir o actualizar una solicitud persistida
- detectar atributos obligatorios faltantes
- conducir el subflujo de completamiento
- conducir la etapa de revision y cierre

Este proceso:

- puede activarse tanto en modalidad `manual` como `automatic`
- puede convertirse en el proceso activo de una conversacion
- puede ser interrumpido por mensajes que cambien el curso de la conversacion
- puede ceder el turno a otro proceso o volver al flujo general si corresponde

## Artefacto principal actual

Hoy el artefacto principal del proceso es:

- `backend/agente/v2/processes/solicitud_materiales/handler.py`

Dependencias principales:

- `llm_client.py`
- `request_validation.py`
- `operation_execution.py`
- `attribute_mapping.py`
- `request_store.py`

## Identidad del proceso

- nombre de proceso: `solicitud_materiales`
- objetivo: administrar una solicitud estructurada de materiales
- entidad principal: `solicitud`
- subestados actuales:
  - `completa_atributos`
  - `revision`

## Principios del esquema

- El backend orquesta todo el flujo entre usuario, solicitud y LLM.
- El backend arma el contexto antes de consultar al LLM.
- El LLM interpreta el mensaje del usuario junto al contexto y sugiere
  decisiones u operaciones.
- El backend ejecuta operaciones, persiste estado y construye la respuesta
  final a partir de estado estructurado.
- La solicitud es la fuente de verdad del proceso.
- La validacion de atributos obligatorios vive en backend.
- Las consultas por atributos faltantes se hacen de a una por vez.
- La inferencia libre sobre lenguaje natural debe vivir en el LLM.
- El backend solo hace inferencia estructurada y controlada sobre respuestas a
  atributos pendientes.
- `completa_atributos` y `revision` son subestados del proceso y no flujos
  aislados del resto de la conversacion.

## Relacion con la modalidad operativa

El comportamiento funcional de `solicitud_materiales` no depende de si el
agente corre en modo `manual` o `automatic`.

La modalidad solo define quien dispara el procesamiento del turno y como se
entrega la salida.

Una vez iniciado el turno, las reglas del proceso son las mismas.

## Activacion del proceso

El proceso puede activarse cuando el backend determina que el mensaje actual
corresponde a un pedido, modificacion, consulta o confirmacion vinculada a una
solicitud de materiales.

### Implementacion actual

Hoy `can_activate(...)` usa este orden:

1. si la oportunidad no es de proyecto, el proceso no aplica
2. si el proceso ya esta activo, tiene maxima prioridad
3. si ya existe una solicitud activa, el proceso continua
4. si el mensaje parece un pedido de materiales, el proceso aplica
5. si la oportunidad es de proyecto, puede quedar como fallback conversacional

## Cierre o salida del proceso

El proceso puede dejar de ser el proceso activo cuando ocurre alguna de estas
condiciones:

- la solicitud queda confirmada
- la solicitud queda vacia y sin consultas pendientes
- el backend determina que el turno no pertenece a este proceso y debe
  reencauzarse
- en el futuro, un flujo de mayor prioridad toma control del turno

## Objetos funcionales

### Solicitud

Representa el borrador actual de materiales de una oportunidad.

Cada solicitud contiene:

- oportunidad_id
- estado
- items
- observaciones
- metadata de auditoria basica

### Item

Cada item de la solicitud puede incluir:

- descripcion
- cantidad
- unidad
- familia
- atributos
- atributos obligatorios faltantes
- consulta activa sobre ese item

### Consulta activa

Representa la ultima pregunta enviada por backend para completar un atributo.

Registra como minimo:

- item_id
- atributo_objetivo
- texto_consulta
- intento_actual
- timestamp
- message_id origen

### Estado conversacional del proceso

Ademas de la solicitud, el proceso mantiene metadatos conversacionales:

- `pending_query`
- `last_user_intent`
- `last_agent_prompt`
- `awaiting_user_decision`
- `ready_for_confirmation`
- `last_operation_summary`
- `last_request_action`

Estos campos los define el backend.

## Contrato funcional del proceso

Este proceso se ajusta al contrato general definido en `agente_proceso.md`.

### Entrada

El proceso requiere como minimo:

- mensaje objetivo del turno
- oportunidad y contacto
- solicitud actual, si existe
- consulta activa, si existe
- historial breve relevante
- catalogos o definiciones de familias y atributos
- estado conversacional del proceso, si existe

### Salida

El proceso devuelve una salida estructurada que permite al backend saber:

- si el turno fue consumido por `solicitud_materiales`
- que accion de negocio debe aplicarse
- cual es el nuevo estado de la solicitud
- si el proceso sigue activo
- si existe respuesta saliente para el usuario
- si hay warnings o ambiguedades

### Acciones esperables del proceso

- alta de item
- actualizacion de item
- eliminacion de item
- limpieza de solicitud
- confirmacion de solicitud
- visualizacion de solicitud
- generacion o mantenimiento de consulta pendiente
- respuesta textual dentro del contexto del proceso
- devolucion del turno al flujo general cuando el mensaje no corresponda a este
  proceso

## Roles

### Backend

- arma el contexto
- consulta al LLM cuando corresponde
- valida la accion sugerida
- ejecuta operaciones sobre la solicitud
- detecta faltantes
- formula preguntas del proceso
- persiste estado de solicitud y estado conversacional
- decide si el proceso consume el turno o si debe reencauzarse

### LLM

- interpreta el mensaje actual usando el contexto entregado
- sugiere acciones y respuestas
- ayuda a destrabar casos ambiguos o mensajes fuera de foco respecto de la
  consulta activa

### Usuario

- envia mensajes libres
- responde consultas de atributos
- confirma, revisa o corrige la solicitud

## Flujo del proceso

### 1. Recepcion del turno

Cada mensaje entrante del usuario llega primero al backend y queda persistido
segun el flujo general del agente.

Este proceso comienza a intervenir cuando el backend le asigna el turno actual.

El backend debe recuperar y preparar:

- oportunidad y datos basicos del contexto
- solicitud actual
- estado actual del proceso
- ultima consulta activa, si existe
- historial minimo necesario de mensajes
- catalogos o definiciones necesarias para validar atributos

### 2. Priorizacion del proceso activo

Antes de consultar al LLM, el backend revisa si la conversacion esta en
`completa_atributos`.

Regla principal:

- si existe una consulta activa, el mensaje nuevo se considera primero como
  posible respuesta directa a esa consulta
- el backend intenta primero un mapeo directo y deterministico sobre el
  atributo pendiente
- solo si ese mapeo directo falla, se consulta al LLM para desambiguar el turno

Esto evita volver a clasificar cada respuesta corta del usuario como si fuera
un mensaje nuevo independiente.

### 3. Consulta al LLM para interpretacion general

Si el backend no esta resolviendo una consulta activa, arma el contexto y lo
envia al LLM para interpretacion.

El contexto incluye como minimo:

- mensaje actual del usuario
- solicitud actual
- estado del flujo
- estado conversacional del proceso
- informacion relevante de mensajes recientes
- catalogo resumido o reglas de negocio necesarias

El LLM puede devolver sugerencias de alto nivel, por ejemplo:

- responder smalltalk
- agregar item a la solicitud
- actualizar item existente
- quitar item
- limpiar solicitud
- mostrar solicitud
- confirmar solicitud
- no operar

## Ejecucion de acciones sugeridas

### Smalltalk

Si la accion sugerida es `smalltalk`, el backend puede responder sin modificar
la solicitud.

Si el proceso ya estaba activo:

- conserva la consulta pendiente si existe
- o conserva el estado de revision si la solicitud esta lista

### Operaciones sobre la solicitud

Si la accion sugerida afecta la solicitud, el backend ejecuta la operacion.

El backend no asume automaticamente que toda salida del LLM es valida.

Debe validar:

- estructura minima
- cantidad valida
- consistencia del item

### Consumo o reencauzado del turno

Luego de interpretar el turno, el backend decide si este proceso:

- consume el turno completamente
- consume el turno parcialmente y mantiene una consulta pendiente
- devuelve el turno al flujo general porque el mensaje no pertenece al proceso

## Verificacion posterior a cada operacion

Luego de cada cambio sobre la solicitud, el backend revisa todos los items para
detectar atributos obligatorios no definidos.

Objetivo de esta verificacion:

- encontrar el primer faltante pendiente
- activar o mantener `completa_atributos`
- generar la proxima consulta al usuario

Si no quedan atributos obligatorios pendientes:

- `completa_atributos` se desactiva
- la solicitud pasa a estado listo para revision
- el proceso entra en `revision`

## Regla especial de cantidad

`cantidad` es un campo estructural obligatorio por linea.

Reglas actuales:

- si la cantidad no aparece en el mensaje, el LLM debe devolver `null`
- `0` no se acepta como placeholder valido
- si un item queda sin cantidad, backend lo marca como faltante y pregunta por
  ella

Esto aplica incluso si la familia y otros atributos del item ya quedaron
definidos.

## Modo `completa_atributos`

### Activacion

Se activa cuando, despues de verificar la solicitud, existe al menos un item
con atributos obligatorios faltantes.

### Desactivacion

Se desactiva cuando todos los atributos obligatorios de todos los items quedan
completos.

### Comportamiento del turno

Cuando este modo esta activo:

- el backend revisa si hay una ultima consulta enviada
- si existe, intenta primero interpretar el nuevo mensaje como respuesta directa
  a esa consulta usando reglas deterministicas
- si logra mapear la respuesta, aplica el atributo sin pasar por el flujo
  general del LLM
- si no logra mapearla, deriva el turno al LLM para desambiguar

### Regla de aplicacion de atributo

La respuesta del usuario se considera valida si:

- el atributo es numerico y la respuesta contiene un numero interpretable
- el atributo es de lista y la respuesta contiene un indice valido de la lista
- el atributo es de lista y la respuesta contiene un texto que corresponde con
  una opcion conocida

### Validacion de atributos tipo lista

Para atributos de tipo lista, el backend puede aplicar validacion no exacta.

Orden recomendado:

1. match exacto normalizado
2. match por alias conocidos
3. match aproximado controlado

Si no hay una unica opcion claramente ganadora:

- el backend no aplica automaticamente el valor
- mantiene el atributo pendiente
- deriva a desambiguacion con LLM o a una nueva consulta

### Desambiguacion de respuesta no mapeable

Si el backend esta en `completa_atributos` y la respuesta del usuario no se
puede mapear al atributo actual:

- no asume automaticamente que el usuario respondio mal
- consulta al LLM con el contexto de la consulta pendiente

Escenarios esperados:

- intento de respuesta a la consulta pendiente
- mensaje independiente que debe volver al flujo normal
- caso ambiguo que requiere aclaracion

## Modo `revision`

### Activacion

Se activa cuando:

- la solicitud tiene items
- no hay faltantes obligatorios
- `estado_solicitud` queda en `ready`

### Objetivo

Guiar al usuario cuando la solicitud ya esta lista.

### Politica actual del backend

Cuando la solicitud queda en `revision`, el backend:

- confirma las operaciones aplicadas
- muestra un resumen de la solicitud
- deja explicito que puede agregar mas materiales o cerrar la solicitud
- conserva ese contexto aunque el usuario mande smalltalk

### Senales estructuradas

En este estado, el proceso persiste:

- `ready_for_confirmation = true`
- `awaiting_user_decision = "continue_or_close"`

## Continuidad del proceso

Despues de cada turno, el backend recalcula el estado del proceso y deja
explicitado alguno de estos resultados:

- `proceso_activo` con consulta pendiente
- `proceso_activo` en `revision`
- `proceso_cerrado` por confirmacion
- `proceso_inactivo` por solicitud vacia
- `turno_reencauzado` al flujo general

## Prioridades de decision

El backend sigue este orden:

1. si hay consulta activa, tratar el mensaje como posible respuesta al atributo
   pendiente
2. intentar mapeo directo sobre el atributo actual
3. si el mapeo directo falla, consultar al LLM para desambiguar si se trata de
   una respuesta fallida o de un mensaje independiente
4. si el mensaje es independiente, reenviarlo al flujo normal de interpretacion
5. aplicar la accion sugerida
6. verificar faltantes obligatorios
7. si hay faltantes, activar o mantener `completa_atributos`
8. si no hay faltantes y hay items, dejar la solicitud en `revision`

## Reglas funcionales importantes

- El LLM interpreta; el backend ejecuta.
- El backend siempre arma el contexto antes de consultar al LLM.
- El backend siempre revalida la solicitud despues de cada operacion.
- La solicitud no debe quedar en un estado inconsistente entre turnos.
- Las consultas de atributos se hacen de a una por vez para reducir ambiguedad.
- En `completa_atributos`, el backend intenta primero un mapeo directo.
- Si el mapeo directo falla, el LLM desambigua el escenario del turno.
- La conduccion del dialogo posterior se arma desde estado estructurado.

## Ejemplo resumido

### Caso base

1. Usuario: `Necesito 10 bolsas de cemento`
2. Backend arma contexto y consulta al LLM
3. LLM sugiere: agregar item
4. Backend agrega el item a la solicitud
5. Backend verifica faltantes y detecta atributo obligatorio `tipo`
6. Backend activa `completa_atributos`
7. Backend pregunta: `Que tipo necesitas para cemento?`

### Respuesta valida

1. Usuario: `Portland`
2. Backend detecta que esta en `completa_atributos`
3. Backend intenta mapear `Portland` al atributo `tipo`
4. Si el mapeo es valido, aplica el valor y vuelve a verificar faltantes
5. Si no quedan faltantes, pasa a `revision`

### Revision

1. Backend muestra resumen de la solicitud
2. Backend agrega una guia: `Si queres, puedo agregar mas materiales o cerrar la solicitud.`

### Escalamiento

1. Backend tiene consulta activa: `Que tipo necesitas para cemento?`
2. Usuario responde: `elimina el item cemento`
3. El mapeo directo falla porque el mensaje no corresponde al atributo `tipo`
4. Backend envia el turno al LLM para desambiguacion
5. El LLM determina que se trata de un mensaje independiente
6. Backend reencauza el mensaje al flujo normal y ejecuta la eliminacion
7. Backend recalcula faltantes y actualiza o invalida la consulta pendiente

## Resultado esperado

El proceso debe producir un flujo predecible, donde:

- el backend administra el estado
- el LLM interpreta lenguaje natural y destraba ambiguedades
- la solicitud evoluciona de forma controlada
- los atributos obligatorios se completan de manera secuencial
- la cantidad queda definida para cada linea
- el usuario recibe preguntas claras y focalizadas
- la solicitud lista entra en `revision` hasta que el usuario agregue mas
  materiales o la confirme
