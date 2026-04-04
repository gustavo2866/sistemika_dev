# Agente de Proceso

## Objetivo

Este documento define el funcionamiento del orquestador general del agente.

Su responsabilidad no es resolver un proceso de negocio especifico, sino
recibir un turno ya identificado por `message_id`, resolver la modalidad
operativa y derivar ese turno al proceso especializado que corresponda.

El detalle funcional de cada proceso especializado vive en su propio documento,
por ejemplo:

- `agente_solicitud.md`
- futuros documentos para agenda, seguimiento u otros procesos

La especificacion tecnica complementaria vive en `agente_tecnico.md`.

## Alcance

Este documento describe:

- el punto de entrada del flujo general
- la responsabilidad del orquestador al recibir un mensaje
- la resolucion de modalidad `manual`, `automatic` o `hybrid`
- la politica de entrega de la salida
- la seleccion del proceso especializado
- el despacho del turno al proceso correspondiente
- el tratamiento del resultado devuelto por ese proceso

Este documento no describe:

- el flujo interno de una solicitud
- reglas de atributos
- prompts especificos de un proceso de negocio
- estados internos detallados de un proceso particular

## Artefacto principal actual

Hoy el artefacto principal de `agente_proceso` es:

- `backend/agente/v2/core/orchestrator.py`

Actores de soporte directos:

- `backend/app/services/meta_webhook_service.py`
- `backend/agente/v2/core/context_loader.py`
- `backend/agente/v2/core/process_registry.py`
- `backend/agente/v2/core/state_repository.py`

## Principio central

El agente de proceso es un despachador y coordinador.

No resuelve por si mismo la logica de negocio de cada conversacion. Su trabajo
es:

1. recibir referencia al mensaje ya persistido
2. resolver la modalidad efectiva
3. resolver la politica de entrega
4. construir el contexto de turno
5. decidir a que proceso especializado enviarlo
6. ejecutar el despacho
7. persistir estado y auditoria
8. enviar salida al canal o devolver preview

## Actores

### Webhook o punto de entrada

Es el origen del turno.

En el caso actual, el flujo comienza cuando llega un mensaje al webhook del
canal WhatsApp.

Responsabilidad actual del webhook:

- validar payload
- asegurar contacto y oportunidad
- persistir el mensaje entrante
- delegar siempre al orquestador con `trigger=webhook`

El webhook no decide si el agente debe procesar o no. Esa decision vive en el
orquestador.

### Agente de proceso

Es el orquestador general.

Responsabilidades:

- recibir el turno
- validar el contexto minimo
- determinar la modalidad efectiva
- determinar la politica de entrega
- resolver el proceso destino
- despachar el turno al proceso correspondiente
- registrar el resultado
- enviar salida al canal si corresponde

### Proceso especializado

Es el modulo que conoce la logica de un dominio especifico.

Ejemplo actual:

- `solicitud_materiales`

Ejemplos futuros:

- agenda
- seguimiento
- confirmacion de datos

Cada proceso especializado debe resolver su propio flujo y devolver un resultado
estructurado al orquestador.

## Modalidades

El orquestador debe resolver la modalidad de ejecucion del turno.

### Manual

En modo `manual`:

- el mensaje se registra
- el webhook igualmente delega el turno al orquestador
- el orquestador detecta `manual` y difiere el procesamiento especializado si
  el `trigger` es `webhook`
- el turno queda disponible para disparo manual posterior sobre el mismo
  orquestador
- cuando ese disparador se ejecuta, el turno debe recorrer el mismo backend y
  el mismo proceso especializado que en modo automatico
- la diferencia no debe estar en la logica del proceso, sino en la forma de
  entregar la salida
- la salida esperada del disparo manual es `preview_only`

### Automatica

En modo `automatic`:

- el mensaje se registra
- el webhook delega al orquestador
- el orquestador continua inmediatamente con la resolucion del proceso destino
- el turno se envia al proceso correspondiente sin intervencion manual
- la salida esperada es `auto_send`

### Hibrida

En modo `hybrid`:

- el webhook delega al orquestador
- el turno se procesa automaticamente
- la interfaz manual sigue disponible para inspeccion o reintento

## Disparo y entrega

La modalidad y la entrega no deben mezclarse.

Hay dos decisiones separadas:

- `trigger`: quien dispara el turno
- `delivery_mode`: que se hace con la salida

Ejemplos de `trigger`:

- `webhook`
- `manual_button`
- `retry`

Ejemplos de `delivery_mode`:

- `auto_send`
- `preview_only`

La regla de diseno es esta:

- el mismo turno debe poder recorrer el mismo orquestador y el mismo proceso
  especializado con distinto `delivery_mode`

Ejemplo:

- `webhook + auto_send`
- `manual_button + preview_only`
- `manual_button + auto_send`

Esto permite que `Respuesta IA` y `Auto responder` usen el mismo backend que el
flujo automatico.

## Flujo general

### 1. Recepcion del mensaje

El flujo comienza al recibir un mensaje entrante en el webhook del canal.

Acciones minimas:

- validar payload
- identificar remitente y canal
- asegurar contacto y oportunidad
- persistir el mensaje entrante
- registrar metadata tecnica
- delegar al orquestador con `message_id`

### 2. Resolucion de modalidad

Luego de persistir el mensaje, el orquestador consulta la configuracion activa.

Si la modalidad es:

- `manual`, el orquestador devuelve un resultado `agent_deferred` cuando el
  turno entra por `webhook`
- `automatic`, el orquestador continua
- `hybrid`, el orquestador continua y deja disponible el camino manual

### 3. Construccion del turno

El orquestador construye un objeto de turno con la informacion necesaria para
despacharlo.

Como minimo:

- mensaje objetivo
- oportunidad
- contacto
- metadata de ejecucion
- estado global del agente
- estado del proceso activo, si existe

### 4. Seleccion del proceso destino

Con el turno ya construido, el orquestador decide a que proceso especializado
enviarlo.

Esa decision puede basarse en:

- un proceso ya activo para esa conversacion
- reglas de entrada declaradas por cada proceso
- prioridad entre procesos candidatos
- configuracion explicita de disparo manual

Implementacion actual:

- la seleccion pasa por `ProcessRegistry`
- hoy solo hay un proceso registrado: `solicitud_materiales`
- ese proceso solo aplica a oportunidades de proyecto
- si no hay procesos candidatos, el orquestador devuelve `no_process`

### 5. Despacho

Una vez resuelto el destino, el orquestador postea el turno al proceso
correspondiente.

Ejemplo actual:

- llega un mensaje al webhook
- el orquestador determina que corresponde `solicitud_materiales`
- el turno se envia a `solicitud_materiales`

### 6. Procesamiento del resultado

El proceso especializado devuelve un resultado estructurado.

El orquestador debe entonces:

- registrar que proceso intervino
- persistir cambios de estado generales
- persistir el estado del proceso especializado
- decidir si corresponde enviar una respuesta al usuario o devolverla como
  preview
- ejecutar la salida por el canal correspondiente

## Responsabilidades exclusivas del orquestador

Estas responsabilidades deben vivir en `agente_proceso` y no en un proceso
especializado:

- resolucion de modalidad
- resolucion de `delivery_mode`
- defer del webhook en modo `manual`
- seleccion del proceso destino
- control del despacho
- auditoria general del turno
- prevencion de reprocesamiento del mismo mensaje
- coordinacion con el canal de salida

## Responsabilidades de un proceso especializado

Estas responsabilidades no deben vivir en `agente_proceso`:

- interpretar el dominio de negocio
- decidir acciones internas del proceso
- mantener estado especifico del proceso
- formular preguntas del proceso
- validar reglas del proceso
- usar prompts propios del proceso

Por ejemplo, `solicitud_materiales` debe describir:

- como se arma una solicitud
- como se completa un atributo faltante
- como se confirma o se limpia una solicitud
- como se guia el dialogo dentro del proceso

Eso no debe explicarse en este documento.

## Seleccion de proceso

La seleccion del proceso destino debe ser modular.

No conviene resolverla como una cadena creciente de logica ad hoc dentro del
webhook.

El orquestador debe apoyarse en un registro de procesos disponibles.

Cada proceso puede declarar:

- nombre
- condiciones de activacion
- prioridad relativa
- capacidad de continuar una conversacion ya activa

## Contrato conceptual del despacho

El orquestador trabaja con un contrato simple.

### Entrada

- mensaje persistido
- contexto minimo del turno
- modalidad efectiva
- `trigger`
- `delivery_mode`

### Salida del proceso especializado

Como minimo, el proceso especializado debe devolver:

- si consumio el turno
- estado actualizado de su proceso
- si sigue activo
- respuesta al usuario, si corresponde
- warnings o errores controlados

El proceso especializado no decide por si mismo si la respuesta se envia o se
muestra como preview. Esa decision pertenece al orquestador.

## Persistencia

El orquestador mantiene el estado general de la conversacion y sabe:

- que mensaje fue el ultimo procesado
- que proceso esta activo, si existe
- cual fue el ultimo resultado del orquestador

Cada proceso especializado persiste su propio estado de proceso por separado o
dentro de un contenedor aislado.

La regla importante es esta:

- el estado general pertenece al orquestador
- el estado de dominio pertenece al proceso especializado

## Relacion con el frontend

El frontend no debe ser responsable del flujo automatico.

Puede existir:

- `Respuesta IA` para preview
- `Auto responder` para disparo manual con envio
- `Solicitud` para abrir la solicitud ya persistida

Esos botones deben invocar el mismo backend que usa el flujo automatico. La
diferencia esperada es el `delivery_mode`.

La fuente de verdad del flujo general sigue estando en backend.

## Extensibilidad

El objetivo de este esquema es permitir que en el futuro se conecten otros
procesos sin reescribir el orquestador.

Para eso, `agente_proceso` debe mantenerse estable y acotado a su funcion de
coordinacion.

Agregar un nuevo proceso deberia requerir:

1. implementar el proceso especializado
2. documentar su flujo en su propio archivo
3. registrarlo en el mecanismo de seleccion del orquestador

No deberia requerir reescribir el flujo general del webhook.

## Relacion entre documentos

- `agente_proceso.md`: describe el orquestador general
- `agente_solicitud.md`: describe el flujo especifico del agente de solicitud
- `agente_tecnico.md`: describe contratos, componentes y estructuras tecnicas

## Resumen conceptual

El flujo correcto es:

1. entra un mensaje por webhook
2. el webhook lo registra y lo vincula a una oportunidad
3. el webhook delega al orquestador
4. el orquestador determina la modalidad
5. el orquestador determina el `delivery_mode`
6. si corresponde procesar, resuelve el proceso destino
7. el orquestador postea el turno al proceso especializado
8. el proceso especializado devuelve un resultado
9. el orquestador persiste y ejecuta la salida o devuelve preview, segun el
   `delivery_mode`

En este esquema, `agente_proceso` no describe ni implementa el flujo interno de
`solicitud_materiales`; solo lo invoca cuando corresponde.
