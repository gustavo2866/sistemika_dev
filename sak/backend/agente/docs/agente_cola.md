# Cola de Procesamiento Basada en asyncio.Queue

## Objetivo

Implementar una cola de procesamiento basada en `asyncio.Queue`, separando claramente los conceptos de persistencia y ejecución.

La base de datos será la fuente de verdad y garantizará la recuperación ante fallas. La cola en memoria se utilizará únicamente para coordinar el procesamiento de mensajes y evitar consultas cíclicas sobre la base de datos.

---

## Principios de Diseño

* La base de datos es la única fuente de verdad.
* La cola en memoria no debe considerarse persistente.
* Solo debe existir un mensaje en procesamiento a la vez.
* Los mensajes deben procesarse en orden de llegada.
* El webhook debe responder a Meta lo antes posible.
* No debe existir polling periódico sobre la base de datos.

---

## Flujo de Recepción

1. El webhook recibe un mensaje desde WhatsApp (Meta).
2. El mensaje se normaliza.
3. Se registra en la base de datos con estado `pendiente`.
4. El identificador del mensaje se agrega a `asyncio.Queue`.
5. El webhook responde inmediatamente `200 OK`.

```text
Meta
 ↓
Webhook
 ↓
Normalización
 ↓
DB (pendiente)
 ↓
asyncio.Queue
 ↓
200 OK
```

---

## Flujo de Procesamiento

Un worker asíncrono permanece esperando elementos en la cola.

Al recibir un identificador:

1. Recupera el mensaje desde la base de datos.
2. Cambia el estado a `en_proceso`.
3. Ejecuta el agente.
4. Registra la respuesta generada.
5. Cambia el estado a `procesado`.

```text
asyncio.Queue
 ↓
Worker
 ↓
DB (en_proceso)
 ↓
Agente
 ↓
DB (procesado)
```

---

## Manejo de Errores

Si ocurre una excepción durante el procesamiento:

* Registrar el detalle del error.
* Cambiar el estado del mensaje a `error`.
* Mantener trazabilidad para reintentos posteriores.

Estados mínimos:

* `pendiente`
* `en_proceso`
* `procesado`
* `error`

Campos recomendados:

* fecha_creacion
* fecha_proceso
* intentos
* error_detalle

---

## Recuperación Ante Reinicio

Al iniciar la aplicación:

1. Consultar todos los mensajes con estado `pendiente`.
2. Consultar todos los mensajes con estado `en_proceso`.
3. Reinsertar sus identificadores en `asyncio.Queue` respetando el orden de creación.
4. Los mensajes que quedaron en `en_proceso` deben reprocesarse automáticamente.

```text
Inicio aplicación
 ↓
Buscar pendientes
Buscar en_proceso
 ↓
Reconstruir cola
 ↓
Continuar procesamiento
```

---

## Beneficios

* Eliminación del polling sobre la base de datos.
* Menor consumo de CPU y transferencia de datos.
* Arquitectura simple y fácil de mantener.
* Recuperación automática ante reinicios.
* Sin dependencias adicionales como Redis, RabbitMQ o Kafka.
* Escalable para futuras mejoras sin modificar el modelo de persistencia.
