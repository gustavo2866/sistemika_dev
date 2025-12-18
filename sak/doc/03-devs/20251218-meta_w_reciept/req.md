# Especificacion: Recepcion de novedades desde meta-w

## Contexto

El backend de sak debe recibir los eventos que envia el modulo meta-w en GCP (message.received, message.sent, message.delivered, message.read, message.failed) y actualizar la tabla `crm_mensajes` siguiendo los estados actuales. La especificacion documentada en `doc/04-meta/INTEGRACION_FRONTEND.md` describe el flujo y ya cuenta con un endpoint de prueba (`POST /api/v1/test/webhook`). Aqui se detalla el desarrollo del webhook definitivo.

> Esta especificación cubre únicamente la **recepción** de mensajes a través del webhook receptor; el ciclo de envío original (creación de mensajes salientes y sus estados iniciales) sigue manejándose por otros componentes y no se redefine aquí.

## Objetivos del desarrollo

1. Añadir un router dedicado que exponga `POST /api/v1/webhooks/meta-w/whatsapp` y que meta-w pueda configurar como su `webhook_url`.
2. Procesar cada evento de Meta sin modificar la logica actual de estados (`RECIBIDO`, `PENDIENTE_ENVIO`, `ERROR_ENVIO`, etc.) y registrar ademas un campo nuevo en `CRMMensaje` que refleje el estado reportado por Meta (por ejemplo `estado_meta` o similar).
3. Asegurar que el endpoint responde `200 OK` ante payload validos para evitar reintentos, y que deja trazas en logs o en `webhook_logs_recibidos`.
4. Permitir que la URL del webhook y el token compartido se configuren por empresa en la tabla `empresas` y validar esos datos antes de procesar cada evento.

## Requisitos funcionales

| ID | Descripcion |
|----|-------------|
| RF-1 | Crear `POST /api/v1/webhooks/meta-w/whatsapp` que reciba JSON con los eventos descritos y registre un log basico. |
| RF-2 | Para `message.received` crear un CRMMensaje nuevo si no existe y guardar `mensaje` completo en `contenido`/`metadata_json`, usando `meta_message_id` como `origen_externo_id`. |
| RF-3 | Para `message.sent` actualizar el mensaje ya existente al estado correspondiente manteniendo la logica actual; guardar `status`, `meta_message_id` y el nuevo campo `estado_meta`. |
| RF-4 | Para `message.delivered` y `message.read` solo actualizar el estado usando `mensaje.set_estado(...)` y refrescar `estado_meta`. |
| RF-5 | Para `message.failed` almacenar `error_code`/`error_message` en `metadata_json`, reflejar el estado Meta y marcar el mensaje como `ERROR_ENVIO` sin alterar el resto de la logica. |
| RF-6 | Validar que `empresa_id` y `celular_id` que vienen en el payload existen y estan habilitados; si no, devolver 404. |
| RF-7 | No duplicar mensajes si ya existe uno con el mismo `meta_message_id` u `origen_externo_id`. |
| RF-8 | Registrar los payloads entrantes en una tabla o sistema de logs para depuracion futura. |

## Estructura del endpoint

- Ruta: `POST /api/v1/webhooks/meta-w/whatsapp`
- Headers esperados: `Content-Type: application/json`, `User-Agent: python-httpx/...`, opcionalmente `x-meta-secret` o `x-api-key`.
- Payload base: (ver `doc/04-meta/INTEGRACION_FRONTEND.md` para la muestra)

```json
{
  "evento": "message.received",
  "mensaje_id": "...",
  "timestamp": "...",
  "mensaje": { ... },
  "status": "received",
  "error_message": null
}
```

- Respuestas:
  - `200 OK` + `{ "status": "ok" }` siempre que el evento sea procesado.
  - `400 Bad Request` si falta `evento` o `mensaje_id`.
  - `404 Not Found` si `empresa_id` o `celular_id` no están registrados.
  - `500 Internal Server Error` solo si hay una excepcion inesperada (y se debe loggear).

## Flujo por evento

| Evento | Accion |
|--------|--------|
| `message.received` | Crear o actualizar el mensaje de entrada; usar `meta_message_id` para relacionarlo, guardar contenido y metadata, marcar estado `RECIBIDO` y actualizar `estado_meta`. |
| `message.sent` | Actualizar el mensaje saliente asociado, marcarlo como `PENDIENTE_ENVIO` o `ENVIADO`, guardar `status` y `meta_message_id` y anotar `estado_meta`. |
| `message.delivered` | Cambiar a estado `ENTREGADO` (o equivalente) y actualizar `estado_meta`. |
| `message.read` | Cambiar a estado `LEIDO` y actualizar `estado_meta`. |
| `message.failed` | Anotar `error_code`/`error_message`, actualizar `metadata_json`, reflejar `estado_meta` y disparar `ERROR_ENVIO` sin romper la logica actual. |

En cada caso se debe invocar `mensaje.set_estado(...)` para que se actualice `fecha_estado`.

## Datos adicionales

- El payload incluye `mensaje.empresa_id`, `mensaje.celular_id` y el número físico del canal (`mensaje.celular.phone_number`) según `doc/04-meta/INTEGRACION_FRONTEND.md`; `mensaje.from_phone` corresponde al celular del cliente y no debe almacenarse en la tabla `crm_celulares`. El webhook debe alinearse con el flujo vigente: cuando llega un evento, buscar si existe un contacto (por `mensaje.celular.phone_number` o un número equivalente en `CRMContacto.telefonos`). Si el contacto existe y tiene una oportunidad activa, relacionar el mensaje nuevo con ese `contacto_id` y `oportunidad_id`; si solo existe el contacto sin oportunidad activa, actualizar únicamente el `contacto_id` y dejar la oportunidad sin cambios.
- Para centralizar configuraciones generales se debe almacenar el `empresa_id` (y eventualmente el `celular_id`) en la tabla `settings` bajo claves como `meta_w_empresa_id` / `meta_w_celular_id`.
- Es obligatorio crear una nueva tabla `crm_celulares` con columnas `id`, `numero_celular`, `meta_celular_id` y `user_id` (opcional). El webhook debe validar que el `meta_celular_id` recibido existe y, si no, insertarlo automáticamente antes de asociar el mensaje.
- Debe existir un campo nuevo en `CRMMensaje` (por ejemplo `estado_meta`) para almacenar el valor recibido en `status` o `evento`.
- Se recomienda guardar un token compartido en `empresas.meta_webhook_secret` y validar el header entrante para mitigar eventos falsos.

## Pruebas y validacion

1. Usar `POST http://localhost:8000/api/v1/test/webhook` para simular cada evento y verificar que `crm_mensajes` refleja el estado y que se responde `200 OK`.
2. Simular `message.failed` y comprobar que `ERROR_ENVIO` se dispara y que `metadata_json` contiene el error.
3. Agregar tests de integracion que inserten un mensaje con `meta_message_id` y luego llamen al webhook para cada evento, comprobando que `estado`, `estado_meta` y `fecha_estado` cambian correctamente.

## Consideraciones operativas

- Antes de mover a produccion, configurar `empresas.webhook_url` con la URL del nuevo router y validar el flujo contra meta-w.
- Documentar en `doc/04-meta/INTEGRACION_FRONTEND.md` que el backend ahora atiende en `/api/v1/webhooks/meta-w/whatsapp` y que el frontend solo renderiza los estados devueltos.
- Mantener la logic de envio actual para la ventana de 24 horas; los cambios aqui solo afectan a la recepcion y al campo adicional de estado Meta.
