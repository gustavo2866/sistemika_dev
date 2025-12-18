# Guía de Integración Frontend - Meta WhatsApp API

## Índice
1. [Introducción](#introducción)
2. [Recibir Notificaciones del Backend](#recibir-notificaciones-del-backend)
3. [Enviar Mensajes](#enviar-mensajes)
4. [Ejemplos de Código](#ejemplos-de-código)

---

## Introducción

Este módulo proporciona una API REST para:
- **Recibir notificaciones** en tiempo real de mensajes entrantes y cambios de estado
- **Enviar mensajes** de WhatsApp (texto libre o templates)

**URL Base del API:**
- Desarrollo local: `http://localhost:8000/api/v1`
- Producción: `https://meta-w-webhook-653893994930.southamerica-east1.run.app/api/v1`

---

## Recibir Notificaciones del Backend

### 1. Configurar Webhook URL de la Empresa

Cada empresa debe tener configurado un `webhook_url` donde recibirá las notificaciones.

**Campo:** `empresas.webhook_url`

**Ejemplo:**
```
https://mi-frontend.com/api/webhooks/whatsapp
```

### 2. Tipos de Eventos que Recibirás

El backend enviará notificaciones mediante `POST` al `webhook_url` configurado con los siguientes tipos de eventos:

#### Evento: `message.received`
Nuevo mensaje entrante del cliente.

**Payload:**
```json
{
  "evento": "message.received",
  "mensaje_id": "fa880989-8d72-4059-bc4d-cca9963c5cee",
  "timestamp": "2025-12-18T03:51:09.166224Z",
  "mensaje": {
    "id": "fa880989-8d72-4059-bc4d-cca9963c5cee",
    "empresa_id": "692d787d-06c4-432e-a94e-cf0686e593eb",
    "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
    "tipo": "text",
    "direccion": "in",
    "from_phone": "5491156384310",
    "from_name": "Gustavo",
    "to_phone": "+15551676015",
    "texto": "Hola, necesito información",
    "status": "received",
    "meta_message_id": "wamid.HBgNNTQ...",
    "meta_timestamp": "2025-12-18T00:51:06",
    "created_at": "2025-12-18T03:51:09.055377",
    "celular": {
      "id": "14b530aa-ff61-44be-af48-957dabde4f28",
      "alias": "WhatsApp Business",
      "phone_number": "+15551676015"
    }
  }
}
```

#### Evento: `message.sent`
Mensaje enviado exitosamente a Meta.

**Payload:**
```json
{
  "evento": "message.sent",
  "mensaje_id": "308e4d17-089b-4a13-b9c8-d635130d960a",
  "timestamp": "2025-12-18T04:01:42.381874Z",
  "status": "sent",
  "meta_message_id": "wamid.HBgNNTQ..."
}
```

#### Evento: `message.delivered`
Mensaje entregado al dispositivo del cliente.

**Payload:**
```json
{
  "evento": "message.delivered",
  "mensaje_id": "308e4d17-089b-4a13-b9c8-d635130d960a",
  "timestamp": "2025-12-18T04:01:54.391004Z",
  "status": "delivered"
}
```

#### Evento: `message.read`
Cliente leyó el mensaje (doble check azul).

**Payload:**
```json
{
  "evento": "message.read",
  "mensaje_id": "308e4d17-089b-4a13-b9c8-d635130d960a",
  "timestamp": "2025-12-18T04:01:59.532027Z",
  "status": "read"
}
```

#### Evento: `message.failed`
Error al enviar el mensaje.

**Payload:**
```json
{
  "evento": "message.failed",
  "mensaje_id": "bbe4f924-a181-4201-a3f1-51afc1c59411",
  "timestamp": "2025-12-18T03:42:56.465675Z",
  "status": "failed",
  "error_code": "131047",
  "error_message": "Message failed to send because more than 24 hours have passed since the customer last replied to this number"
}
```

### 3. Implementar Endpoint en tu Frontend

Debes crear un endpoint que reciba estos webhooks:

**Método:** `POST`
**Content-Type:** `application/json`

**Headers que recibirás:**
- `Content-Type: application/json`
- `User-Agent: python-httpx/0.26.0`

**Ejemplo de implementación (Node.js/Express):**

```javascript
app.post('/api/webhooks/whatsapp', async (req, res) => {
  const { evento, mensaje_id, timestamp, mensaje, status, error_message } = req.body;
  
  console.log(`📩 Webhook recibido: ${evento} - Mensaje: ${mensaje_id}`);
  
  try {
    switch (evento) {
      case 'message.received':
        // Nuevo mensaje entrante
        await handleNewMessage(mensaje);
        break;
        
      case 'message.sent':
        // Actualizar UI: mensaje enviado
        await updateMessageStatus(mensaje_id, 'sent');
        break;
        
      case 'message.delivered':
        // Actualizar UI: mensaje entregado
        await updateMessageStatus(mensaje_id, 'delivered');
        break;
        
      case 'message.read':
        // Actualizar UI: mensaje leído (doble check azul)
        await updateMessageStatus(mensaje_id, 'read');
        break;
        
      case 'message.failed':
        // Mostrar error en UI
        await handleMessageError(mensaje_id, error_message);
        break;
    }
    
    // IMPORTANTE: Responder 200 OK para confirmar recepción
    res.status(200).json({ status: 'ok' });
    
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Ejemplo de implementación (Python/FastAPI):**

```python
from fastapi import APIRouter, Request
from typing import Dict, Any

router = APIRouter()

@router.post("/api/webhooks/whatsapp")
async def recibir_webhook(request: Request) -> Dict[str, str]:
    payload = await request.json()
    
    evento = payload.get("evento")
    mensaje_id = payload.get("mensaje_id")
    
    print(f"📩 Webhook recibido: {evento} - Mensaje: {mensaje_id}")
    
    if evento == "message.received":
        mensaje = payload.get("mensaje")
        await handle_new_message(mensaje)
        
    elif evento in ["message.sent", "message.delivered", "message.read"]:
        await update_message_status(mensaje_id, payload.get("status"))
        
    elif evento == "message.failed":
        await handle_message_error(
            mensaje_id, 
            payload.get("error_message")
        )
    
    return {"status": "ok"}
```

### 4. Estrategia de Payloads

El backend envía dos tipos de payloads:

**Payload Completo** (eventos `message.received` y `message.sent`):
- Incluye objeto `mensaje` completo con todos los datos
- Útil para crear/actualizar el mensaje en tu base de datos

**Payload Ligero** (eventos `message.delivered`, `message.read`, `message.failed`):
- Solo incluye `mensaje_id`, `status`, y campos relevantes
- Más eficiente para actualizaciones de estado

---

## Enviar Mensajes

### Endpoint: `POST /api/v1/mensajes/send`

Envía mensajes de WhatsApp. El backend decide automáticamente si usar texto libre o template según la ventana de 24 horas.

#### Lógica de Decisión Automática

1. **Si el cliente escribió hace menos de 24h:** Envía texto libre
2. **Si el cliente NO escribió en las últimas 24h:** Usa template aprobado

#### Request Body

```json
{
  "empresa_id": "692d787d-06c4-432e-a94e-cf0686e593eb",
  "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
  "telefono_destino": "5491156384310",
  "texto": "¡Hola! Gracias por contactarnos. Tu pedido está en camino.",
  "nombre_contacto": "Juan Pérez",
  "template_fallback_name": "notificacion_general",
  "template_fallback_language": "es_AR"
}
```

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `empresa_id` | UUID | ✅ | ID de la empresa |
| `celular_id` | UUID | ✅ | ID del número de WhatsApp Business |
| `telefono_destino` | string | ✅ | Teléfono del destinatario (sin +, ej: 5491156384310) |
| `texto` | string | ✅ | Mensaje a enviar |
| `nombre_contacto` | string | ❌ | Nombre para personalizar template (parámetro `{{1}}`) |
| `template_fallback_name` | string | ❌ | Nombre del template a usar fuera de 24h (default: "notificacion_general") |
| `template_fallback_language` | string | ❌ | Idioma del template (default: "es_AR") |

#### Response (201 Created)

```json
{
  "id": "308e4d17-089b-4a13-b9c8-d635130d960a",
  "empresa_id": "692d787d-06c4-432e-a94e-cf0686e593eb",
  "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
  "from_phone": null,
  "from_name": null,
  "to_phone": "5491156384310",
  "meta_message_id": "wamid.HBgNNTQ5MTE1NjM4NDMxMBUCABEYEjY3QUJFMzYxNDBFMTU5NTYyRAA=",
  "direccion": "out",
  "tipo": "text",
  "texto": null,
  "template_name": null,
  "contenido": {
    "body": "¡Hola! Gracias por contactarnos. Tu pedido está en camino."
  },
  "status": "sent",
  "error_code": null,
  "error_message": null,
  "estado": "pendiente",
  "meta_timestamp": null,
  "created_at": "2025-12-18T04:01:14.121723",
  "procesado_fecha": null
}
```

#### Errores Comunes

**401 Unauthorized**
```json
{
  "detail": "Error al enviar mensaje a Meta: Client error '401 Unauthorized'"
}
```
**Solución:** Token de Meta expirado o inválido. Actualizar `empresas.meta_access_token`.

**422 Unprocessable Entity**
```json
{
  "detail": "No se encontró el último mensaje del contacto para validar ventana de 24h"
}
```
**Solución:** Es el primer mensaje al contacto, se usará template automáticamente.

**500 Internal Server Error**
```json
{
  "detail": "Error al enviar mensaje: Message failed to send because more than 24 hours have passed..."
}
```
**Solución:** Template no aprobado o no existe. Aprobar template en Meta Business Manager.

---

## Ejemplos de Código

### React/TypeScript: Hook para recibir notificaciones

```typescript
// hooks/useWhatsAppNotifications.ts
import { useEffect } from 'react';

interface WhatsAppNotification {
  evento: 'message.received' | 'message.sent' | 'message.delivered' | 'message.read' | 'message.failed';
  mensaje_id: string;
  timestamp: string;
  mensaje?: any;
  status?: string;
  error_message?: string;
}

export const useWhatsAppNotifications = (onNotification: (notification: WhatsAppNotification) => void) => {
  useEffect(() => {
    // Implementar WebSocket o polling según tu arquitectura
    // Este es un ejemplo conceptual
    
    const handleWebhook = async () => {
      // Tu lógica de escucha de eventos
    };
    
    return () => {
      // Cleanup
    };
  }, [onNotification]);
};

// Uso en componente
const ChatComponent = () => {
  useWhatsAppNotifications((notification) => {
    switch (notification.evento) {
      case 'message.received':
        addMessageToChat(notification.mensaje);
        break;
      case 'message.read':
        updateMessageStatus(notification.mensaje_id, 'read');
        break;
      // ... otros casos
    }
  });
};
```

### React/TypeScript: Hook para enviar mensajes

```typescript
// hooks/useWhatsAppSend.ts
import { useState } from 'react';

interface SendMessageParams {
  empresa_id: string;
  celular_id: string;
  telefono_destino: string;
  texto: string;
  nombre_contacto?: string;
}

export const useWhatsAppSend = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sendMessage = async (params: SendMessageParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/v1/mensajes/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al enviar mensaje');
      }
      
      const mensaje = await response.json();
      return mensaje;
      
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { sendMessage, loading, error };
};

// Uso en componente
const ChatInput = ({ empresaId, celularId, destinatario }: Props) => {
  const { sendMessage, loading } = useWhatsAppSend();
  const [texto, setTexto] = useState('');
  
  const handleSubmit = async () => {
    try {
      await sendMessage({
        empresa_id: empresaId,
        celular_id: celularId,
        telefono_destino: destinatario,
        texto: texto,
      });
      setTexto('');
      // Mostrar éxito
    } catch (err) {
      // Mostrar error
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={texto} 
        onChange={(e) => setTexto(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
};
```

### JavaScript/Fetch: Ejemplo simple

```javascript
// Enviar mensaje
async function enviarMensajeWhatsApp(destinatario, mensaje) {
  try {
    const response = await fetch('http://localhost:8000/api/v1/mensajes/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        empresa_id: '692d787d-06c4-432e-a94e-cf0686e593eb',
        celular_id: '14b530aa-ff61-44be-af48-957dabde4f28',
        telefono_destino: destinatario,
        texto: mensaje,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Error al enviar mensaje');
    }
    
    const data = await response.json();
    console.log('Mensaje enviado:', data.id);
    return data;
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Uso
enviarMensajeWhatsApp('5491156384310', 'Hola, ¿cómo estás?');
```

---

## Flujo Completo de Conversación

### Diagrama de Secuencia

```
Cliente WhatsApp          Meta API          Backend          Frontend
      |                      |                  |                 |
      |------ Mensaje ------>|                  |                 |
      |                      |--- Webhook ----->|                 |
      |                      |                  |                 |
      |                      |                  |-- POST -------->|
      |                      |                  |   (message.     |
      |                      |                  |    received)    |
      |                      |                  |<----- 200 ------|
      |                      |                  |                 |
      |                      |                  |                 |
      |                      |<-- POST Mensaje -|<-- Responder ---|
      |<----- Mensaje -------|                  |                 |
      |                      |                  |                 |
      |                      |--- Status ------>|                 |
      |                      |    (sent)        |-- POST -------->|
      |                      |                  |   (message.     |
      |                      |                  |    sent)        |
      |                      |                  |<----- 200 ------|
      |                      |                  |                 |
      |                      |--- Status ------>|                 |
      |                      |    (delivered)   |-- POST -------->|
      |                      |                  |   (message.     |
      |                      |                  |    delivered)   |
      |                      |                  |<----- 200 ------|
      |                      |                  |                 |
      |------ Lee mensaje -->|                  |                 |
      |                      |--- Status ------>|                 |
      |                      |    (read)        |-- POST -------->|
      |                      |                  |   (message.     |
      |                      |                  |    read)        |
      |                      |                  |<----- 200 ------|
```

---

## Ventana de 24 Horas

### ¿Qué es?

Meta WhatsApp solo permite enviar mensajes de texto libre dentro de las **24 horas** desde el último mensaje del cliente.

### Reglas

✅ **Dentro de 24h:** Puedes enviar texto libre
❌ **Fuera de 24h:** Solo puedes usar templates aprobados por Meta

### ¿Cómo se resetea?

**Cada vez que el cliente te escribe**, la ventana de 24h se reinicia.

### Implementación en el Backend

El backend verifica automáticamente:
1. Busca el último mensaje entrante (`direccion = 'in'`) del contacto
2. Calcula si pasaron más de 24 horas
3. Decide entre texto libre o template

**No necesitas preocuparte por esto en el frontend**, el backend lo maneja automáticamente.

---

## Testing

### Endpoint de Prueba

Para probar el flujo de webhooks sin modificar tu frontend, puedes usar el endpoint de testing del backend:

**URL:** `POST http://localhost:8000/api/v1/test/webhook`

Este endpoint:
- Recibe cualquier payload JSON
- Lo guarda en `webhook_logs_recibidos`
- Retorna el `log_id` para referencia

**Ver logs recibidos:**
```bash
python check_webhooks_recibidos.py
```

---

## Configuración Inicial

### 1. Configurar Webhook URL en la Empresa

```sql
UPDATE empresas 
SET webhook_url = 'https://tu-frontend.com/api/webhooks/whatsapp'
WHERE id = '692d787d-06c4-432e-a94e-cf0686e593eb';
```

### 2. Verificar Token de Meta

```sql
SELECT meta_access_token FROM empresas WHERE id = '692d787d-06c4-432e-a94e-cf0686e593eb';
```

### 3. Probar Envío de Mensaje

```bash
curl -X POST http://localhost:8000/api/v1/mensajes/send \
  -H "Content-Type: application/json" \
  -d '{
    "empresa_id": "692d787d-06c4-432e-a94e-cf0686e593eb",
    "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
    "telefono_destino": "5491156384310",
    "texto": "Mensaje de prueba"
  }'
```

---

## Troubleshooting

### No llegan las notificaciones al webhook

1. **Verificar webhook_url configurado:**
   ```sql
   SELECT webhook_url FROM empresas WHERE id = 'TU_EMPRESA_ID';
   ```

2. **Ver logs del backend:**
   ```bash
   cd backend
   python check_webhook_logs.py
   ```

3. **Verificar que tu endpoint responde 200 OK**

### Error 401 al enviar mensajes

**Causa:** Token de Meta expirado

**Solución:**
```bash
cd backend
python update_token_db.py
```
Editar el archivo con el nuevo token y ejecutar.

### Mensajes no se envían fuera de 24h

**Causa:** Template no aprobado o no existe

**Solución:**
1. Ir a Meta Business Manager
2. Aprobar template "notificacion_general"
3. O especificar otro template en el request:
   ```json
   {
     "template_fallback_name": "tu_template_aprobado",
     "template_fallback_language": "es_AR"
   }
   ```

---

## Recursos Adicionales

- **Documentación Meta WhatsApp Business API:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **Guía de Templates:** https://developers.facebook.com/docs/whatsapp/message-templates
- **Códigos de Error:** https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

---

**Versión:** 1.0  
**Última actualización:** Diciembre 2025
