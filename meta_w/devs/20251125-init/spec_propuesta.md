# Propuesta de Especificación – Meta WhatsApp API System

## 1. Visión
Construir una plataforma multi-empresa que centralice la recepción y envío de mensajes WhatsApp a través de la Cloud API de Meta. El sistema habilita a cada empresa a operar su propia flota de celulares verificados, acceder vía API a sus mensajes y orquestar automatizaciones (chatbots, backoffice) con trazabilidad completa.

## 2. Alcance
- **Backend (FastAPI + PostgreSQL/Neon)**: Gestión multi-tenant, integración con Meta, almacenamiento histórico, webhooks, métricas y seguridad.
- **Frontend (Next.js + shadcn admin kit)**: Panel SaaS para administrar empresas, celulares, plantillas y monitorear conversaciones.
- **Servicios complementarios**: ngrok en desarrollo, Cloud Run en producción, Vercel para frontend y colas (Celery/RQ) para tareas async.
- Quedan fuera: automatizaciones complejas de IA, campañas masivas y WhatsApp On-Premise (se podrán planificar como fases futuras).

## 3. Actores
| Actor | Descripción | Interacciones |
|-------|-------------|---------------|
| **Administrador Plataforma** | Equipo interno que crea empresas y gestiona credenciales globales. | Panel y API admin. |
| **Empresa Cliente** | Organización que consume la plataforma. | Panel y API propias, tokens scoped por empresa. |
| **Service Account / Bot** | Sistemas de cada empresa que consumen API Rest para enviar/leer mensajes. | Endpoints /auth, /mensajes, /webhook. |
| **Meta WhatsApp Cloud API** | Servicio externo que emite webhooks y recibe envíos. | HTTP outbound e inbound. |

## 4. Arquitectura General
```
Clientes -> Frontend (Next.js) -> FastAPI (JWT + multi-tenant) -> PostgreSQL/Neon
                                     |-> Workers async (envíos, webhook)
                                     |-> Meta Graph API
Meta Webhook -> FastAPI webhook endpoint -> DB + cola de eventos
```
- **Comunicación**: API REST JSON, autenticación con JWT/ApiKey por empresa. El frontend utiliza los mismos endpoints. Webhooks de Meta se exponen vía HTTPS público (ngrok dev, Cloud Run prod).
- **Segregación multi-tenant**: Todas las operaciones requieren `empresa_id` y se filtran por columnas en BD.

## 5. Backend (resumen)
Referencia detallada en `devs/20251125-init/spec_backend.md`.
- **Modelos clave**: `empresas`, `celulares`, `contactos`, `conversaciones`, `mensajes`, `webhook_eventos`, `plantillas_meta`, `logs_integracion`.
- **Endpoints**: CRUD de empresas/celulares/contactos, lectura de mensajes, envío (template y session), webhook oficial y sincronización de plantillas.
- **Integración Meta**:
  - Envío `POST /{phone_number_id}/messages` (v22.0) con tokens propios por empresa.
  - Recepción de webhooks `GET/POST /webhooks/meta/whatsapp` validando `hub.verify_token`.
  - Manejo de conversaciones según ventanas de 24 h y categorías de conversación (marketing, utility, authentication, service).
- **Procesos async**: Workers para reintentos de envíos, sincronización de plantillas y procesamiento pesado de webhooks. Se recomienda Redis + RQ/Celery.

## 6. Frontend
- **Tecnologías**: Next.js 15 App Router + TypeScript + shadcn/ui + Tailwind.
- **Módulos principales**:
  1. **Autenticación**: login + refresh tokens, selección de empresa si el usuario tiene múltiples.
  2. **Dashboard**: métricas (mensajes enviados/recibidos, estatus de celulares, eventos recientes).
  3. **Empresas** (solo admin): CRUD, visualización de tokens, rotación de `webhook_secret`.
  4. **Celulares**: tabla con estados, phone number id, cuota utilizada, opciones para pausar/activar.
  5. **Contactos**: búsqueda rápida, tags y detalle de conversaciones.
  6. **Mensajes/Chat**: vista tipo inbox con historial, estados (sent, delivered, read) y posibilidad de enviar chats manuales.
  7. **Plantillas**: sincronización desde Meta, vista de variables y pruebas de envío.
  8. **Logs/Alertas**: tabla de `logs_integracion` con filtros por resultado, request id y celular.
- **Estados y stores**: Zustand para estado global (empresa seleccionada, Sesión) y React Query para datos paginados.
- **Internacionalización**: Soporte mínimo en español; se prevé ampliación con i18n.

## 7. Integraciones clave con Meta
1. **Envío Template** (ya validado por el cURL provisto):
   ```bash
   curl -i -X POST \
     https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages \
     -H "Authorization: Bearer {ACCESS_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{ "messaging_product": "whatsapp", "to": "541156384310", "type": "template", "template": { "name": "hello_world", "language": { "code": "en_US" } } }'
   ```
2. **Session/Text**: `type="text"`, requiere conversación activa (<24 h desde último mensaje del usuario).
3. **Media Upload**: `POST /{phone_number_id}/media` antes de enviar `image/document/audio`.
4. **Webhooks**: Recepción de `messages`, `statuses`, `errors`. Persistir `entry.id` y permitir reintentos vía `webhook_eventos`.
5. **Templates**: `GET /{WABA_ID}/message_templates` para sincronización y `POST /message_templates` para alta (futuro).

## 8. Seguridad y Cumplimiento
- **Autenticación**: OAuth2 Password/JWT o API Key con `X-Api-Key` y `X-Empresa-Id`.
- **Autorización**: Scope por empresa y roles (`admin plataforma`, `admin empresa`, `operador`).
- **Protección tokens**: cifrado AES/GCP Secret Manager. Rotación automática planificada.
- **Rate limiting**: por empresa (ej. 60 req/min) y por webhook (para evitar denegación).
- **Observabilidad**: logs estructurados, métricas Prometheus (total mensajes, errores, latencia Meta), alertas Cloud Monitoring.
- **Cumplimiento**: GDPR/LPDP -> registro de consentimientos, mecanismos para borrar contactos.

## 9. Calidad y pruebas
- **Niveles**:
  - Unit tests: modelos, servicios de integración, validaciones de cuotas.
  - API tests: FastAPI + pytest + httpx.
  - End-to-end: escenarios críticos con Postman o Playwright (chat manual, webhook end-to-end).
- **Casos prioritarios** (extracto):
  1. Alta de empresa y celular (multi-tenant).
  2. Envío de template exitoso + actualización de estados `sent/delivered`.
  3. Rechazo por cuota excedida / celular inactivo.
  4. Procesamiento de webhook con creación de contacto y mensaje inbound.
  5. Rotación de tokens y reintento de envío.
  6. Sincronización de plantillas y visualización en frontend.

## 10. Roadmap sugerido
1. **Fase 1 – Fundamentos**: modelos, migraciones, CRUD básico de empresas/celulares, autenticación, webhook base.
2. **Fase 2 – Mensajería**: envío template/session, almacenamiento full, UI de chat, logs integrados.
3. **Fase 3 – Operaciones**: dashboards, límites y alertas, sincronización de plantillas, soporte multi idioma.
4. **Fase 4 – Escalabilidad**: workers dedicados, colas, monitoreo avanzado, herramientas de automatización.

## 11. Entregables
- Documentación actualizada (`spec_backend`, `spec_propuesta`, manuales de entorno).
- Infraestructura lista en dev (Docker/ngrok) y pipelines básicos (CI lint+tests).
- Demo funcional cubriendo: alta de empresa, asignación de celular, envío y recepción de mensajes (plantilla + texto).
