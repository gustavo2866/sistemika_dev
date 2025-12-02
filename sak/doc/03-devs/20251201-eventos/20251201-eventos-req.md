# Refactorización del Modelo de Eventos - CRM

**Fecha:** 1 de Diciembre, 2025  
**Sistema:** SAK (Sistemika) - Módulo CRM  
**Tipo:** Requerimiento Funcional - Simplificación de Modelo

---

## Tabla de Contenidos

1. [Objetivo](#objetivo)
2. [Modelo de Datos](#modelo-de-datos)
3. [Casos de Uso](#casos-de-uso)
4. [Integración con Panel de Actividades](#integración-con-panel-de-actividades)
5. [Notas Técnicas](#notas-técnicas)

---

## Objetivo

Simplificar la gestión de eventos en el CRM para:

1. **Facilitar el seguimiento** - Timeline claro de todas las interacciones con el cliente
2. **Mejorar la documentación** - Resultado obligatorio al cerrar cada evento
3. **Reducir complejidad** - Un solo tipo de evento sin clasificaciones múltiples
4. **Agilizar la creación** - Formularios más simples con campos esenciales

### ¿Qué es un Evento?

Un evento representa cualquier interacción o actividad relacionada con una oportunidad:
- Llamadas telefónicas realizadas o programadas
---

## Modelo de Datos

### Estructura de un Evento
Todos los eventos están vinculados a una **oportunidad específica** y forman su timeline de actividades.

---

## Modelo de Datos Simplificado

### Tabla: `crm_eventos`

| Campo | Tipo | Descripción | Obligatorio | Default |
|-------|------|-------------|-------------|---------|
| `id` | Integer | Identificador único | Sí (PK) | Auto |
| `oportunidad_id` | Integer | FK a CRMOportunidad | Sí | - |
| `titulo` | String(255) | Título/resumen breve del evento | Sí | - |
| `tipo_evento` | String(20) | Tipo de evento | Sí | - |
| `fecha_evento` | DateTime | Fecha y hora del evento | Sí | - |
| `descripcion` | Text | Descripción ampliada del evento | No | null |
| `estado` | String(20) | Estado del evento | Sí | 'pendiente' |
| `resultado` | Text | Resultado/conclusión del evento | Condicional* | null |
| `asignado_a_id` | Integer | FK a User | Sí | - |
| `created_at` | DateTime | Fecha de creación | Auto | now() |
| `updated_at` | DateTime | Fecha de actualización | Auto | now() |
| `deleted_at` | DateTime | Fecha de eliminación (soft delete) | No | null |

**\* Condicional**: `resultado` es obligatorio cuando `estado` es `realizado`, `cancelado` o `reagendar`

---

### Valores Permitidos

#### Tipos de Evento (`tipo_evento`):

- **`llamada`** - Llamada telefónica (realizada o programada)
- **`reunion`** - Reunión presencial o virtual
- **`visita`** - Visita a una propiedad
- **`email`** - Correo electrónico enviado
- **`whatsapp`** - Mensaje de WhatsApp
- **`nota`** - Nota interna del equipo

#### Estados (`estado`):

- **`1-pendiente`** - Evento programado, aún no realizado
- **`2-realizado`** - Evento completado exitosamente
- **`3-cancelado`** - Evento que no se llevó a cabo
- **`4-reagendar`** - Evento que requiere reprogramación

---

### Relaciones

```mermaid
erDiagram
---

## Casos de Uso

### Caso de Uso 1: Programar una Visita

**Actor:** Agente de ventas  
**Objetivo:** Programar una visita a una propiedad con un cliente

**Flujo:**
1. El agente está en el detalle de una oportunidad
2. Hace clic en "+ Nuevo Evento" en el panel de actividades
3. Completa el formulario:
   - **Título:** "Visita a departamento 2 dormitorios"
   - **Tipo:** Visita
   - **Fecha:** 15/12/2025 10:00
   - **Descripción:** "Mostrar unidad 405. Cliente interesado en financiación"
4. El evento queda en estado **Pendiente**
5. El sistema envía un recordatorio al agente

**Endpoint utilizado:** `POST /api/crm/eventos` (CRUD estándar)

---

### Caso de Uso 2: Cerrar un Evento Realizado

**Actor:** Agente de ventas  
**Objetivo:** Registrar el resultado de una visita completada

**Flujo:**
1. El agente ve en su lista de eventos pendientes la visita del día
2. Después de realizar la visita, hace clic en "Cerrar"
3. Selecciona el estado: **Realizado**
4. **Ingresa el resultado** (obligatorio):
   - "Cliente muy interesado. Le gustó la ubicación. Solicitó cotización formal con financiamiento a 24 meses."
5. El evento queda registrado con toda la información del resultado
6. Opcionalmente puede crear un evento de seguimiento: "Enviar cotización"

**Endpoint utilizado:** `POST /api/crm/eventos/{id}/cerrar` (endpoint custom)

---

### Caso de Uso 3: Reagendar un Evento

**Actor:** Agente de ventas  
**Objetivo:** Reprogramar una visita que el cliente canceló

**Flujo:**
1. El agente recibe mensaje del cliente que no puede asistir a la visita de mañana
2. Abre el evento pendiente
3. Hace clic en "Cerrar" y selecciona **Reagendar**
4. Ingresa el motivo: "Cliente tuvo una emergencia laboral"
5. Ingresa la nueva fecha: 20/12/2025 10:00
6. El sistema:
   - Cierra el evento original con estado "Reagendar"
   - Crea automáticamente un nuevo evento para la nueva fecha
7. El timeline de la oportunidad muestra ambos eventos

**Endpoint utilizado:** `POST /api/crm/eventos/{id}/reagendar` (endpoint custom)

---

### Caso de Uso 4: Ver Timeline de una Oportunidad

**Actor:** Agente de ventas o supervisor  
**Objetivo:** Ver el historial completo de interacciones con un cliente

**Flujo:**
1. El usuario entra al detalle de una oportunidad
2. Hace clic en la pestaña "Actividades"
3. Ve una lista cronológica de todos los eventos:
   - 📞 Llamada de seguimiento - Realizado (10/12)
   - 🏠 Visita a departamento - Realizado (15/12)
   - ✉️ Envío de cotización - Pendiente (16/12)
4. Puede filtrar por tipo, estado o fechas
5. Cada evento muestra su resultado si está cerrado

**Endpoint utilizado:** `GET /api/crm/oportunidades/{id}/eventos` (endpoint custom)

---

### Caso de Uso 5: Crear Evento desde un Mensaje

**Actor:** Agente de ventas  
**Objetivo:** Programar un seguimiento desde un mensaje de WhatsApp recibido

**Flujo:**
1. El agente recibe un mensaje de WhatsApp: "¿Tienen opciones de financiamiento?"
2. El mensaje ya está vinculado a una oportunidad existente
3. Hace clic en "Crear Evento" desde el mensaje
4. El formulario se pre-carga con:
   - **Título:** "Responder: ¿opciones de financiamiento?"
   - **Tipo:** WhatsApp
   - **Descripción:** Extracto del mensaje
5. El agente ajusta la fecha y confirma
6. El evento queda vinculado tanto a la oportunidad como al mensaje

**Endpoint utilizado:** `POST /api/crm/mensajes/{id}/crear-evento` (endpoint custom)

---

### Caso de Uso 6: Panel de Eventos Pendientes

**Actor:** Agente de ventas  
**Objetivo:** Ver su agenda de eventos pendientes para la semana

**Flujo:**
1. El agente abre su dashboard personal
2. Ve un widget "Mis Eventos Pendientes" que muestra:
   - **3 eventos vencidos** (en rojo)
   - **2 eventos para hoy** (en amarillo)
   - **7 eventos próximos** (próximos 7 días)
3. Hace clic en un evento para ver detalles o cerrarlo
4. Puede filtrar por tipo (solo visitas, solo llamadas, etc.)

**Endpoint utilizado:** `GET /api/crm/eventos/pendientes/usuario/{id}` (endpoint custom) Contexto

El panel de actividades permite visualizar y gestionar eventos (y mensajes) en el contexto de:
1. Una **oportunidad específica**
2. Un **mensaje vinculado a una oportunidad**

### Escenarios de Creación

#### 1. Crear Evento desde Oportunidad

**Ubicación:** Panel de Oportunidad → Tab "Actividades" → Botón "Nuevo Evento"

**Pre-carga de datos:**
```javascript
{
  oportunidad_id: oportunidad.id,           // Pre-cargado
  asignado_a_id: oportunidad.responsable_id, // Pre-cargado (puede cambiar)
  estado: 'pendiente',                       // Default
  fecha_evento: null                         // Usuario debe ingresar
}
```

**Formulario:**
- Título (requerido)
- Tipo de evento (requerido - dropdown)
- Fecha y hora (requerido - datetime picker)
- Descripción (opcional - textarea)
- Asignado a (requerido - dropdown de usuarios, pre-cargado con responsable)

**Submit:**
```javascript
POST /api/crm/eventos
{
  oportunidad_id: 12,
  titulo: "Visita programada",
  tipo_evento: "visita",
  fecha_evento: "2025-12-15T10:00:00",
  descripcion: "...",
  asignado_a_id: 1,
  estado: "pendiente"
}
```

---

#### 2. Crear Evento desde Mensaje

**Ubicación:** Panel de Mensajes → Mensaje individual → Botón "Crear Evento"

**Pre-requisito:** El mensaje debe tener `oportunidad_id` asociado

**Pre-carga de datos:**
```javascript
{
  oportunidad_id: mensaje.oportunidad_id,     // Pre-cargado
  titulo: "Responder: " + mensaje.asunto,     // Sugerido
  tipo_evento: mapTipoEvento(mensaje.canal),  // Sugerido según canal
  descripcion: extracto(mensaje.contenido),   // Sugerido
  asignado_a_id: mensaje.responsable_id,      // Pre-cargado
  estado: 'pendiente'
}
```

**Mapeo sugerido tipo_evento:**
```javascript
const mapTipoEvento = (canal) => {
  switch(canal) {
    case 'whatsapp': return 'whatsapp';
    case 'email': return 'email';
    case 'telefono': return 'llamada';
    default: return 'nota';
  }
}
```

**Formulario:**
Similar al anterior, pero con datos pre-cargados del mensaje.

**Submit:**
```javascript
POST /api/crm/mensajes/{mensaje_id}/crear-evento
{
  titulo: "Responder consulta sobre financiación",
  tipo_evento: "whatsapp",
  fecha_evento: "2025-12-02T10:00:00",
  descripcion: "...",
  asignado_a_id: 1
}
```

---

### Visualización en Panel de Actividades

**Estructura del Panel:**

```
┌─────────────────────────────────────────────────────┐
│  ACTIVIDADES                           [+ Nuevo]    │
├─────────────────────────────────────────────────────┤
│  Filtros: [ Todos ▼ ] [ Pendientes ▼ ] [Buscar...] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ○ 15/12/2025 10:00 - PENDIENTE                    │
│     📋 Visita a departamento 2 dormitorios          │
│     Mostrar unidad 405...                           │
│     Asignado: Juan Pérez                            │
│     [Cerrar] [Editar] [Eliminar]                    │
│                                                      │
│  ✓ 10/12/2025 15:00 - REALIZADO                    │
│     📞 Llamada de seguimiento                       │
│     Cliente confirmó interés. Solicitó visita...    │
│     Resultado: "Se acordó visita para el 15/12"    │
│     Asignado: Juan Pérez                            │
│     [Ver detalle]                                   │
│                                                      │
│  ✗ 08/12/2025 14:00 - CANCELADO                    │
│     🏢 Reunión en oficina                           │
│     Resultado: "Cliente canceló por emergencia"     │
│     [Ver detalle]                                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Iconos por tipo:**
- 📞 Llamada
- 🏢 Reunión
- 🏠 Visita
- ✉️ Email
- 💬 WhatsApp
- 📝 Nota

**Badges de estado:**
- ○ PENDIENTE (amarillo)
- ✓ REALIZADO (verde)
- ✗ CANCELADO (rojo)
- ⟳ REAGENDAR (naranja)

---

### Flujo de Cerrar Evento

**Ubicación:** Panel de Actividades → Evento pendiente → Botón "Cerrar"

**Modal de Cierre:**

```
┌────────────────────────────────────────────┐
│  Cerrar Evento                        [×]  │
├────────────────────────────────────────────┤
│                                             │
│  Evento: Visita a departamento 2 dorm      │
│  Fecha: 15/12/2025 10:00                   │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │ Estado: [Realizado      ▼]          │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │ Resultado: *                         │  │
│  │ ┌─────────────────────────────────┐ │  │
│  │ │ Cliente muy interesado, le      │ │  │
│  │ │ gustó la ubicación y el layout. │ │  │
│  │ │ Solicitó cotización formal...   │ │  │
│  │ └─────────────────────────────────┘ │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  □ Crear evento de seguimiento             │
│                                             │
│       [Cancelar]  [Guardar]                │
└────────────────────────────────────────────┘
```

**Opciones de estado:**
- Realizado
- Cancelado
- Reagendar

**Si selecciona "Reagendar":**
- Se muestra campo adicional "Nueva fecha"
- Al guardar, cierra el evento actual y crea uno nuevo

**Si marca "Crear evento de seguimiento":**
- Después de cerrar, abre modal de nuevo evento con contexto

**Submit:**
```javascript
POST /api/crm/eventos/{id}/cerrar
{
  estado: "realizado",
  resultado: "Cliente muy interesado..."
}
```

---

### API para Panel de Actividades

**Endpoint unificado:**
```http
GET /api/crm/oportunidades/{oportunidad_id}/actividades?tipo=eventos&estado=pendiente
```

**Parámetros:**
- `tipo`: `eventos`, `mensajes`, `todos` (default: todos)
- `estado`: Filtro por estado
- `desde`: Fecha desde
- `hasta`: Fecha hasta

**Response:**
```json
{
  "oportunidad_id": 12,
  "total": 15,
  "actividades": [
    {
      "tipo_actividad": "evento",
      "id": 45,
      "titulo": "Visita a departamento",
      "fecha": "2025-12-15T10:00:00",
      "estado": "pendiente",
      "tipo_evento": "visita",
      "asignado_a": {
        "id": 1,
        "nombre": "Juan Pérez"
      }
    },
    {
      "tipo_actividad": "mensaje",
      "id": 123,
      "asunto": "Consulta sobre financiación",
      "fecha": "2025-12-10T14:30:00",
      "canal": "whatsapp",
      "estado": "recibido"
    }
  ]
}
```

---

## Plan de Migración

### Fase 1: Preparación (1-2 días)

1. ✅ Crear backup de la tabla `crm_eventos` actual
2. ✅ Documentar queries existentes que usan la tabla
3. ✅ Identificar dependencias en el código

### Fase 2: Migración de Base de Datos (1 día)

**Script de migración Alembic:**

```python
"""simplificar_eventos

Revision ID: 20251201_simplificar_eventos
Revises: previous_revision
Create Date: 2025-12-01

"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. Agregar nuevas columnas
    op.add_column('crm_eventos', 
        sa.Column('titulo', sa.String(255), nullable=True))
    op.add_column('crm_eventos', 
        sa.Column('tipo_evento', sa.String(20), nullable=True))
    op.add_column('crm_eventos', 
        sa.Column('resultado', sa.Text(), nullable=True))
    
    # 2. Migrar datos existentes
    # titulo = descripcion[:255] o tipo.nombre + " - " + motivo.nombre
    op.execute("""
        UPDATE crm_eventos e
        SET titulo = COALESCE(
            SUBSTRING(e.descripcion, 1, 255),
            CONCAT(
                (SELECT nombre FROM crm_tipos_evento WHERE id = e.tipo_id),
                ' - ',
                (SELECT nombre FROM crm_motivos_evento WHERE id = e.motivo_id)
            )
        )
    """)
    
    # tipo_evento = mapeo desde tipo_id
    op.execute("""
        UPDATE crm_eventos e
        SET tipo_evento = CASE 
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) = 'LLAMADA' THEN 'llamada'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) = 'REUNION' THEN 'reunion'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) = 'VISITA' THEN 'visita'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) = 'EMAIL' THEN 'email'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) = 'WHATSAPP' THEN 'whatsapp'
            ELSE 'nota'
        END
    """)
    
    # estado_evento → estado
    op.alter_column('crm_eventos', 'estado_evento', new_column_name='estado')
    
    # Actualizar estados: 'hecho' → 'realizado'
    op.execute("""
        UPDATE crm_eventos 
        SET estado = 'realizado' 
        WHERE estado = 'hecho'
    """)
    
    # 3. Hacer obligatorias las nuevas columnas
    op.alter_column('crm_eventos', 'titulo', nullable=False)
    op.alter_column('crm_eventos', 'tipo_evento', nullable=False)
    
    # 4. Eliminar columnas obsoletas
    op.drop_constraint('fk_eventos_contacto', 'crm_eventos', type_='foreignkey')
    op.drop_constraint('fk_eventos_tipo', 'crm_eventos', type_='foreignkey')
    op.drop_constraint('fk_eventos_motivo', 'crm_eventos', type_='foreignkey')
    op.drop_constraint('fk_eventos_origen_lead', 'crm_eventos', type_='foreignkey')
    
    op.drop_column('crm_eventos', 'contacto_id')
    op.drop_column('crm_eventos', 'tipo_id')
    op.drop_column('crm_eventos', 'motivo_id')
    op.drop_column('crm_eventos', 'origen_lead_id')
    op.drop_column('crm_eventos', 'proximo_paso')
    op.drop_column('crm_eventos', 'fecha_compromiso')
    
    # 5. Crear nuevos índices
    op.create_index('idx_eventos_tipo', 'crm_eventos', ['tipo_evento'])

def downgrade():
    # Reversión de cambios (agregar columnas antiguas, etc.)
    pass
```

### Fase 3: Actualizar Modelo SQLAlchemy (1 día)

```python
# backend/app/models/crm_evento.py

class CRMEvento(db.Model):
    __tablename__ = 'crm_eventos'
    
    id = Column(Integer, primary_key=True)
    oportunidad_id = Column(Integer, ForeignKey('crm_oportunidades.id'), nullable=False)
    titulo = Column(String(255), nullable=False)
    tipo_evento = Column(String(20), nullable=False)
    fecha_evento = Column(DateTime, nullable=False)
    descripcion = Column(Text, nullable=True)
    estado = Column(String(20), nullable=False, default='pendiente')
    resultado = Column(Text, nullable=True)
    asignado_a_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relaciones
    oportunidad = relationship('CRMOportunidad', back_populates='eventos')
    asignado_a = relationship('User', back_populates='eventos_asignados')
    
    # Configuración para CRUD genérico
    __searchable_fields__ = ['titulo', 'descripcion', 'resultado']
    __filterable_fields__ = ['oportunidad_id', 'tipo_evento', 'estado', 'asignado_a_id']
    __sortable_fields__ = ['fecha_evento', 'created_at', 'estado']
    __expanded_list_relations__ = ['asignado_a', 'oportunidad']
    
    def to_dict(self):
        return {
            'id': self.id,
            'oportunidad_id': self.oportunidad_id,
            'titulo': self.titulo,
            'tipo_evento': self.tipo_evento,
            'fecha_evento': self.fecha_evento.isoformat() if self.fecha_evento else None,
            'descripcion': self.descripcion,
            'estado': self.estado,
            'resultado': self.resultado,
            'asignado_a_id': self.asignado_a_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
```

### Fase 4: Actualizar Endpoints (2 días)

1. Actualizar `backend/app/routes/crm_eventos.py`
2. Implementar nuevos endpoints custom:
   - `/cerrar`
   - `/reagendar`
   - `/pendientes/usuario/{user_id}`
   - `/estadisticas`
3. Actualizar endpoint de mensajes: `/crear-evento`
4. Actualizar endpoint de oportunidades: `/eventos`

### Fase 5: Actualizar Frontend (3-4 días)

1. Actualizar formulario de creación de eventos
2. Actualizar panel de actividades
3. Implementar modal de cierre de eventos
4. Actualizar listados y filtros
5. Actualizar componentes de visualización

### Fase 6: Testing (2 días)

1. Tests unitarios de modelos
2. Tests de endpoints
3. Tests de integración
4. Tests E2E del flujo completo

### Fase 7: Despliegue (1 día)

1. Deploy a ambiente de staging
2. Pruebas de usuario
3. Deploy a producción
4. Monitoreo post-deploy

---

## Consideraciones Adicionales

### Backwards Compatibility

Durante un período de transición (1-2 semanas), mantener endpoints legacy:
- `/api/crm/eventos` (legacy) → redirige a nueva estructura
- Deprecation headers en responses legacy

### Performance

- Índices optimizados para queries frecuentes
- Paginación obligatoria en listados
- Eager loading de relaciones en endpoints de detalle

### Seguridad

- Validar que el usuario tiene permisos sobre la oportunidad
- Auditoría de cambios de estado
- Rate limiting en endpoints de creación

### Monitoreo

- Métricas de uso por tipo de evento
- Tasa de cumplimiento de eventos pendientes
- Tiempo promedio de cierre de eventos

---

**Fin del documento**
---

## Notas Técnicas

### Reutilización de Patrones CRUD Existentes

**Todos los endpoints utilizan los patrones CRUD ya implementados en el sistema:**

1. **CRUD Estándar** - Los endpoints básicos (crear, listar, obtener, actualizar, eliminar) utilizan el patrón genérico existente en `backend/app/routes/base_crud.py`

2. **Endpoints Custom** - Los endpoints especiales (`/cerrar`, `/reagendar`, `/pendientes/usuario`, etc.) se agregan como rutas adicionales siguiendo el mismo patrón que en otros módulos del CRM

3. **Modelo SQLAlchemy** - El modelo `CRMEvento` utiliza las mismas convenciones que los otros modelos CRM:
   - `__searchable_fields__` para búsqueda de texto
   - `__filterable_fields__` para filtros
   - `__sortable_fields__` para ordenamiento
   - `__expanded_list_relations__` para eager loading

4. **Validaciones** - Se utilizan los mismos decoradores `@validates` de SQLAlchemy que en otros modelos

5. **Soft Delete** - Se mantiene el patrón de soft delete con el campo `deleted_at`

### Cambios en el Modelo Actual

**Campos a eliminar:**
- `contacto_id` - Se obtiene via `oportunidad.contacto_id`
- `tipo_id` + `motivo_id` - Reemplazados por `tipo_evento` (string/enum)
- `origen_lead_id` - No aporta valor
- `proximo_paso` + `fecha_compromiso` - Redundantes

**Campos a agregar:**
- `titulo` - String(255), obligatorio
- `resultado` - Text, condicional (obligatorio al cerrar)

**Campos a modificar:**
- `estado_evento` → `estado` (renombrar)
- Valores de estado: agregar `cancelado`, `reagendar`

### Migración de Datos

La migración Alembic debe:
1. Agregar nuevas columnas (`titulo`, `tipo_evento`, `resultado`)
2. Migrar datos de `tipo_id` a `tipo_evento` (mapeo de códigos)
3. Generar `titulo` desde `descripcion` o combinación tipo+motivo
4. Renombrar `estado_evento` a `estado`
5. Mapear `hecho` → `realizado`
6. Eliminar columnas obsoletas y sus foreign keys
7. Crear índices optimizados