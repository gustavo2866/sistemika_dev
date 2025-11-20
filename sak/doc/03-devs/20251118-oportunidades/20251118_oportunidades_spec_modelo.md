# Especificación Técnica - Modelo de Datos CRM Oportunidades

> **Referencia:** [20251118_oportunidades_req.md](./20251118_oportunidades_req.md)  
> **Patrones:** [README_BACKEND_PATTERNS_v1.md](../README_BACKEND_PATTERNS_v1.md)  
> **Versión:** 1.0  
> **Fecha:** 2025-11-18  
> **Autor:** Sistema

---

## 1. CATÁLOGOS (Tablas de Configuración)

### 1.1 `catalogo_tipo_operacion`

Tipos de operación inmobiliaria.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(20) | UNIQUE, NOT NULL, index | Código único (ej: "alquiler") |
| nombre | str(100) | NOT NULL | Nombre descriptivo |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `oportunidades`: One-to-Many → `Oportunidad.tipo_operacion`

**Metadata:**
```python
__tablename__ = "catalogo_tipo_operacion"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Seed Data:**
```python
[
    {"codigo": "alquiler", "nombre": "Alquiler", "activo": True},
    {"codigo": "venta", "nombre": "Venta", "activo": True},
    {"codigo": "emprendimiento", "nombre": "Emprendimiento", "activo": True},
]
```

---

### 1.2 `catalogo_motivo_perdida`

Motivos por los cuales se pierde una oportunidad.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(50) | UNIQUE, NOT NULL, index | Código único |
| nombre | str(150) | NOT NULL | Descripción del motivo |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `oportunidades`: One-to-Many → `Oportunidad.motivo_perdida`

**Metadata:**
```python
__tablename__ = "catalogo_motivo_perdida"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Seed Data:**
```python
[
    {"codigo": "precio", "nombre": "Precio muy alto", "activo": True},
    {"codigo": "ubicacion", "nombre": "Ubicación no conveniente", "activo": True},
    {"codigo": "estado", "nombre": "Estado de la propiedad", "activo": True},
    {"codigo": "competencia", "nombre": "Eligió otra opción", "activo": True},
    {"codigo": "financiamiento", "nombre": "No obtuvo financiamiento", "activo": True},
    {"codigo": "desistio", "nombre": "Desistió sin motivo", "activo": True},
    {"codigo": "no_responde", "nombre": "No responde contactos", "activo": True},
    {"codigo": "ya_vendida", "nombre": "Propiedad ya vendida/alquilada", "activo": True},
    {"codigo": "otro", "nombre": "Otro motivo", "activo": True},
]
```

---

### 1.3 `catalogo_condicion_pago`

Condiciones de pago aceptadas.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(50) | UNIQUE, NOT NULL, index | Código único |
| nombre | str(200) | NOT NULL | Descripción de la condición |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `oportunidades`: One-to-Many → `Oportunidad.condicion_pago`

**Metadata:**
```python
__tablename__ = "catalogo_condicion_pago"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Seed Data:**
```python
[
    {"codigo": "contado", "nombre": "Contado", "activo": True},
    {"codigo": "30_dias", "nombre": "30 días", "activo": True},
    {"codigo": "60_dias", "nombre": "60 días", "activo": True},
    {"codigo": "cuotas_3", "nombre": "3 cuotas", "activo": True},
    {"codigo": "cuotas_6", "nombre": "6 cuotas", "activo": True},
    {"codigo": "cuotas_12", "nombre": "12 cuotas", "activo": True},
    {"codigo": "hipotecario", "nombre": "Crédito hipotecario", "activo": True},
    {"codigo": "permuta", "nombre": "Permuta", "activo": True},
    {"codigo": "otro", "nombre": "Otra condición", "activo": True},
]
```

---

### 1.4 `catalogo_tipo_evento`

Tipos de interacción/evento con contactos.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(50) | UNIQUE, NOT NULL, index | Código único |
| nombre | str(100) | NOT NULL | Descripción del tipo |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `eventos`: One-to-Many → `Evento.tipo`

**Metadata:**
```python
__tablename__ = "catalogo_tipo_evento"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Seed Data:**
```python
[
    {"codigo": "presencial", "nombre": "Presencial", "activo": True},
    {"codigo": "whatsapp", "nombre": "WhatsApp", "activo": True},
    {"codigo": "llamado", "nombre": "Llamado telefónico", "activo": True},
    {"codigo": "mail", "nombre": "Email", "activo": True},
    {"codigo": "redes", "nombre": "Redes sociales", "activo": True},
]
```

---

### 1.5 `catalogo_motivo_evento`

Motivos de los eventos (consulta, oferta, visita, etc.).

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(50) | UNIQUE, NOT NULL, index | Código único |
| nombre | str(100) | NOT NULL | Descripción del motivo |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `eventos`: One-to-Many → `Evento.motivo`

**Metadata:**
```python
__tablename__ = "catalogo_motivo_evento"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Seed Data:**
```python
[
    {"codigo": "consulta", "nombre": "Consulta inicial", "activo": True},
    {"codigo": "oferta", "nombre": "Presentación de oferta", "activo": True},
    {"codigo": "visita", "nombre": "Visita a propiedad", "activo": True},
    {"codigo": "negociacion", "nombre": "Negociación", "activo": True},
    {"codigo": "seguimiento", "nombre": "Seguimiento", "activo": True},
    {"codigo": "documentacion", "nombre": "Documentación", "activo": True},
    {"codigo": "otros", "nombre": "Otros", "activo": True},
]
```

---

### 1.6 `catalogo_origen_lead`

Origen de los leads/contactos.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(50) | UNIQUE, NOT NULL, index | Código único |
| nombre | str(100) | NOT NULL | Descripción del origen |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `contactos`: One-to-Many → `Contacto.origen_lead`
- `eventos`: One-to-Many → `Evento.origen_lead`

**Metadata:**
```python
__tablename__ = "catalogo_origen_lead"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Seed Data:**
```python
[
    {"codigo": "online", "nombre": "Online (web/redes)", "activo": True},
    {"codigo": "referidos", "nombre": "Referidos", "activo": True},
    {"codigo": "walk_in", "nombre": "Walk-in (espontáneo)", "activo": True},
    {"codigo": "campana", "nombre": "Campaña publicitaria", "activo": True},
    {"codigo": "inmobiliaria", "nombre": "Red de inmobiliarias", "activo": True},
    {"codigo": "otros", "nombre": "Otros", "activo": True},
]
```

---

### 1.7 `catalogo_moneda`

Monedas soportadas en el sistema.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| codigo | str(10) | UNIQUE, NOT NULL, index | Código ISO (ARS, USD, EUR) |
| nombre | str(100) | NOT NULL | Nombre de la moneda |
| simbolo | str(10) | NOT NULL | Símbolo ($, US$, €) |
| es_default | bool | NOT NULL, default=False | Si es la moneda por defecto |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `oportunidades`: One-to-Many → `Oportunidad.moneda`
- `cotizaciones_origen`: One-to-Many → `CotizacionMoneda.moneda_origen`
- `cotizaciones_destino`: One-to-Many → `CotizacionMoneda.moneda_destino`

**Metadata:**
```python
__tablename__ = "catalogo_moneda"
__searchable_fields__ = ["codigo", "nombre"]
__expanded_list_relations__ = set()
```

**Validaciones:**
- Solo puede haber una moneda con `es_default=True`

**Seed Data:**
```python
[
    {"codigo": "ARS", "nombre": "Peso Argentino", "simbolo": "$", "es_default": True, "activo": True},
    {"codigo": "USD", "nombre": "Dólar Estadounidense", "simbolo": "US$", "es_default": False, "activo": True},
    {"codigo": "EUR", "nombre": "Euro", "simbolo": "€", "es_default": False, "activo": True},
]
```

---

### 1.8 `cotizacion_moneda`

Tabla de tipos de cambio entre monedas.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| moneda_origen_id | int | FK, NOT NULL, index | Moneda origen |
| moneda_destino_id | int | FK, NOT NULL, index | Moneda destino |
| tipo_cambio | Decimal(18,6) | NOT NULL, >0 | Tipo de cambio |
| fecha_vigencia | date | NOT NULL, index | Fecha desde la cual es válido |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `moneda_origen`: Many-to-One → `CatalogoMoneda`
- `moneda_destino`: Many-to-One → `CatalogoMoneda`

**Metadata:**
```python
__tablename__ = "cotizacion_moneda"
__searchable_fields__ = []
__expanded_list_relations__ = {"moneda_origen", "moneda_destino"}
```

**Índices compuestos:**
```python
# Índice para búsqueda eficiente de cotizaciones vigentes
Index("idx_cotizacion_moneda_lookup", "moneda_origen_id", "moneda_destino_id", "fecha_vigencia")
```

**Validaciones:**
- `moneda_origen_id != moneda_destino_id`
- `tipo_cambio > 0`

**Seed Data:**
```python
[
    # USD a ARS
    {"moneda_origen_id": 2, "moneda_destino_id": 1, "tipo_cambio": 1000.00, "fecha_vigencia": "2025-11-01"},
    {"moneda_origen_id": 2, "moneda_destino_id": 1, "tipo_cambio": 1050.00, "fecha_vigencia": "2025-11-15"},
    
    # EUR a ARS
    {"moneda_origen_id": 3, "moneda_destino_id": 1, "tipo_cambio": 1100.00, "fecha_vigencia": "2025-11-01"},
    {"moneda_origen_id": 3, "moneda_destino_id": 1, "tipo_cambio": 1150.00, "fecha_vigencia": "2025-11-15"},
    
    # EUR a USD
    {"moneda_origen_id": 3, "moneda_destino_id": 2, "tipo_cambio": 1.10, "fecha_vigencia": "2025-11-01"},
]
```

---

## 2. ENTIDADES PRINCIPALES

### 2.1 `contacto`

Registro de contactos/personas interesadas.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| nombre_completo | str(255) | NOT NULL, index | Nombre completo del contacto |
| telefonos | JSON | NOT NULL, default=[] | Lista de teléfonos ["123456", "789012"] |
| email | str(255) | NULL, index | Email del contacto |
| red_social | str(255) | NULL | Usuario de red social o contacto |
| origen_lead_id | int | FK, NULL | Origen del lead |
| responsable_id | int | FK, NOT NULL | Usuario responsable |
| notas | str(1000) | NULL | Notas adicionales |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `origen_lead`: Many-to-One → `CatalogoOrigenLead`
- `responsable`: Many-to-One → `User`
- `oportunidades`: One-to-Many → `Oportunidad.contacto`
- `eventos`: One-to-Many → `Evento.contacto`

**Metadata:**
```python
__tablename__ = "contactos"
__searchable_fields__ = ["nombre_completo", "email"]
__expanded_list_relations__ = {"origen_lead", "responsable"}
```

**Índices compuestos:**
```python
# Para deduplicación
Index("idx_contacto_email", "email", postgresql_where="email IS NOT NULL AND deleted_at IS NULL")
```

**Validaciones:**
- Al menos uno de `telefonos` (con al menos 1 elemento) o `email` debe estar presente
- Los teléfonos en JSON deben ser strings no vacíos

**Lógica de deduplicación:**
- Al crear, buscar contacto existente por email (si se proporciona) o por algún teléfono
- Si existe match exacto, reutilizar ese contacto (no crear uno nuevo)
- Retornar el contacto encontrado o el recién creado

**Seed Data:**
```python
[
    {
        "nombre_completo": "Juan Pérez",
        "telefonos": ["1122334455", "1166778899"],
        "email": "juan.perez@example.com",
        "origen_lead_id": 1,  # online
        "responsable_id": 1,
        "notas": "Contacto inicial por web"
    },
    {
        "nombre_completo": "María González",
        "telefonos": ["1155667788"],
        "email": "maria.gonzalez@example.com",
        "origen_lead_id": 2,  # referidos
        "responsable_id": 1,
        "notas": "Referido por cliente actual"
    },
]
```

---

### 2.2 `oportunidad`

Oportunidad de negocio inmobiliario.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| contacto_id | int | FK, NOT NULL, index | Contacto asociado |
| tipo_operacion_id | int | FK, NOT NULL, index | Tipo de operación |
| emprendimiento_id | int | FK, NULL, index | Emprendimiento (si aplica) |
| propiedad_id | int | FK, NOT NULL, index | Propiedad asociada |
| estado | str(20) | NOT NULL, index | Estado actual |
| fecha_estado | datetime | NOT NULL | Fecha del último cambio de estado |
| motivo_perdida_id | int | FK, NULL | Motivo si estado=6-Perdida |
| monto | Decimal(15,2) | NULL, >=0 | Monto/precio esperado |
| moneda_id | int | FK, NULL | Moneda del monto |
| condicion_pago_id | int | FK, NULL | Condición de pago |
| probabilidad | int | NULL, 0-100 | Probabilidad de cierre (%) |
| fecha_cierre_estimada | date | NULL | Fecha estimada de cierre |
| responsable_id | int | FK, NOT NULL | Usuario responsable |
| descripcion_estado | str(1000) | NULL | Descripción/notas del estado actual |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Estados permitidos (enum):**
```python
class EstadoOportunidad(str, Enum):
    ABIERTA = "1-abierta"
    VISITA = "2-visita"
    COTIZA = "3-cotiza"
    RESERVA = "4-reserva"
    GANADA = "5-ganada"
    PERDIDA = "6-perdida"
```

**Relaciones:**
- `contacto`: Many-to-One → `Contacto`
- `tipo_operacion`: Many-to-One → `CatalogoTipoOperacion`
- `emprendimiento`: Many-to-One → `Emprendimiento` (NULL si no aplica)
- `propiedad`: Many-to-One → `Propiedad`
- `motivo_perdida`: Many-to-One → `CatalogoMotivoPerdida` (NULL si no está perdida)
- `moneda`: Many-to-One → `CatalogoMoneda`
- `condicion_pago`: Many-to-One → `CatalogoCondicionPago`
- `responsable`: Many-to-One → `User`
- `logs_estado`: One-to-Many → `OportunidadLogEstado.oportunidad`
- `eventos`: One-to-Many → `Evento.oportunidad`

**Metadata:**
```python
__tablename__ = "oportunidades"
__searchable_fields__ = ["descripcion_estado"]
__expanded_list_relations__ = {
    "contacto", "tipo_operacion", "propiedad", 
    "motivo_perdida", "moneda", "condicion_pago", "responsable"
}
```

**Índices compuestos:**
```python
# Para búsquedas por estado y fecha
Index("idx_oportunidad_estado_fecha", "estado", "fecha_estado")
# Para dashboard comercial
Index("idx_oportunidad_tipo_estado", "tipo_operacion_id", "estado", "created_at")
```

**Validaciones de transición de estados:**

| Estado Actual | Estados Permitidos |
|---------------|-------------------|
| 1-abierta | 2-visita, 3-cotiza, 6-perdida |
| 2-visita | 3-cotiza, 6-perdida |
| 3-cotiza | 4-reserva, 5-ganada, 6-perdida |
| 4-reserva | 5-ganada, 6-perdida |
| 5-ganada | 1-abierta (reapertura con motivo) |
| 6-perdida | 1-abierta (reapertura con motivo) |

**Reglas de negocio por transición:**
- Al pasar a `6-perdida`: requiere `motivo_perdida_id`
- Al pasar a `5-ganada` o `4-reserva`: requiere `monto`, `moneda_id`, `condicion_pago_id`
- Siempre se debe registrar `descripcion_estado` en cambio de estado
- Cada cambio de estado genera un registro en `oportunidad_log_estado`

**Seed Data:**
```python
[
    {
        "contacto_id": 1,
        "tipo_operacion_id": 1,  # alquiler
        "propiedad_id": 1,
        "estado": "1-abierta",
        "fecha_estado": "2025-11-10T10:00:00",
        "responsable_id": 1,
        "descripcion_estado": "Consulta inicial por departamento en Palermo"
    },
    {
        "contacto_id": 2,
        "tipo_operacion_id": 2,  # venta
        "propiedad_id": 3,
        "estado": "2-visita",
        "fecha_estado": "2025-11-12T15:00:00",
        "monto": 250000,
        "moneda_id": 2,  # USD
        "responsable_id": 1,
        "descripcion_estado": "Visita programada para el 15/11"
    },
]
```

---

### 2.3 `oportunidad_log_estado`

Log de cambios de estado de oportunidades.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| oportunidad_id | int | FK, NOT NULL, index | Oportunidad |
| estado_anterior | str(20) | NULL | Estado anterior (NULL si es creación) |
| estado_nuevo | str(20) | NOT NULL | Nuevo estado |
| usuario_id | int | FK, NOT NULL | Usuario que realizó el cambio |
| fecha_cambio | datetime | NOT NULL, index | Fecha del cambio |
| descripcion | str(1000) | NOT NULL | Descripción del cambio |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Relaciones:**
- `oportunidad`: Many-to-One → `Oportunidad`
- `usuario`: Many-to-One → `User`

**Metadata:**
```python
__tablename__ = "oportunidad_log_estado"
__searchable_fields__ = ["descripcion"]
__expanded_list_relations__ = {"usuario"}
```

**Índices compuestos:**
```python
# Para timeline de oportunidad
Index("idx_log_oportunidad_fecha", "oportunidad_id", "fecha_cambio")
```

**Seed Data:**
```python
[
    {
        "oportunidad_id": 1,
        "estado_anterior": None,
        "estado_nuevo": "1-abierta",
        "usuario_id": 1,
        "fecha_cambio": "2025-11-10T10:00:00",
        "descripcion": "Oportunidad creada - Consulta inicial por departamento en Palermo"
    },
    {
        "oportunidad_id": 2,
        "estado_anterior": "1-abierta",
        "estado_nuevo": "2-visita",
        "usuario_id": 1,
        "fecha_cambio": "2025-11-12T15:00:00",
        "descripcion": "Programada visita para el 15/11"
    },
]
```

---

### 2.4 `evento`

Registro de interacciones con contactos.

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| contacto_id | int | FK, NOT NULL, index | Contacto asociado |
| tipo_id | int | FK, NOT NULL | Tipo de evento |
| motivo_id | int | FK, NOT NULL | Motivo del evento |
| fecha_evento | datetime | NOT NULL, index | Fecha/hora del evento |
| descripcion | str(2000) | NOT NULL | Descripción detallada |
| asignado_a_id | int | FK, NOT NULL | Usuario asignado |
| oportunidad_id | int | FK, NULL, index | Oportunidad vinculada (opcional) |
| origen_lead_id | int | FK, NULL | Origen del lead (si aplica) |
| proximo_paso | str(500) | NULL | Próximo paso acordado |
| fecha_compromiso | date | NULL | Fecha compromiso para seguimiento |
| estado_evento | str(20) | NOT NULL, default="pendiente" | Estado del evento |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Estados del evento (enum):**
```python
class EstadoEvento(str, Enum):
    PENDIENTE = "pendiente"
    HECHO = "hecho"
```

**Relaciones:**
- `contacto`: Many-to-One → `Contacto`
- `tipo`: Many-to-One → `CatalogoTipoEvento`
- `motivo`: Many-to-One → `CatalogoMotivoEvento`
- `asignado_a`: Many-to-One → `User`
- `oportunidad`: Many-to-One → `Oportunidad` (NULL si no está vinculado)
- `origen_lead`: Many-to-One → `CatalogoOrigenLead`

**Metadata:**
```python
__tablename__ = "eventos"
__searchable_fields__ = ["descripcion", "proximo_paso"]
__expanded_list_relations__ = {
    "contacto", "tipo", "motivo", "asignado_a", 
    "oportunidad", "origen_lead"
}
```

**Índices compuestos:**
```python
# Para timeline de contacto
Index("idx_evento_contacto_fecha", "contacto_id", "fecha_evento")
# Para timeline de oportunidad
Index("idx_evento_oportunidad_fecha", "oportunidad_id", "fecha_evento")
# Para seguimientos pendientes
Index("idx_evento_estado_fecha", "estado_evento", "fecha_compromiso")
```

**Lógica especial:**
- Si el evento no tiene `contacto_id`, intentar buscar/crear contacto por datos proporcionados
- Si el evento no tiene `oportunidad_id` pero se proporciona info de tipo_operacion y propiedad, crear oportunidad automáticamente en estado `1-abierta`
- Si el evento está vinculado a oportunidad y se indica un nuevo estado, validar transición y actualizar oportunidad + crear log

**Seed Data:**
```python
[
    {
        "contacto_id": 1,
        "tipo_id": 1,  # presencial
        "motivo_id": 1,  # consulta
        "fecha_evento": "2025-11-10T10:00:00",
        "descripcion": "Cliente consultó por departamento de 2 ambientes en Palermo",
        "asignado_a_id": 1,
        "oportunidad_id": 1,
        "estado_evento": "hecho"
    },
    {
        "contacto_id": 2,
        "tipo_id": 2,  # whatsapp
        "motivo_id": 3,  # visita
        "fecha_evento": "2025-11-12T15:00:00",
        "descripcion": "Coordinar visita a oficina en microcentro",
        "asignado_a_id": 1,
        "oportunidad_id": 2,
        "proximo_paso": "Confirmar horario de visita",
        "fecha_compromiso": "2025-11-14",
        "estado_evento": "pendiente"
    },
]
```

---

## 3. MODIFICACIONES A TABLAS EXISTENTES

### 3.1 `propiedades`

**Nuevos campos:**

| Campo | Tipo | Restricciones | Descripción | Default |
|-------|------|---------------|-------------|---------|
| tipo_operacion_id | int | FK, NULL, index | Tipo de operación principal | NULL |
| emprendimiento_id | int | FK, NULL, index | Emprendimiento al que pertenece | NULL |
| costo_propiedad | Decimal(15,2) | NULL, >=0 | Costo de adquisición/construcción | NULL |

**Nuevas relaciones:**
- `tipo_operacion`: Many-to-One → `CatalogoTipoOperacion`
- `emprendimiento`: Many-to-One → `Emprendimiento` (si aplica)
- `oportunidades`: One-to-Many → `Oportunidad.propiedad`

**Migración:**
```sql
-- Agregar columnas
ALTER TABLE propiedades 
    ADD COLUMN tipo_operacion_id INTEGER NULL,
    ADD COLUMN emprendimiento_id INTEGER NULL,
    ADD COLUMN costo_propiedad DECIMAL(15,2) NULL;

-- Agregar foreign keys
ALTER TABLE propiedades
    ADD CONSTRAINT fk_propiedades_tipo_operacion 
        FOREIGN KEY (tipo_operacion_id) REFERENCES catalogo_tipo_operacion(id),
    ADD CONSTRAINT fk_propiedades_emprendimiento
        FOREIGN KEY (emprendimiento_id) REFERENCES emprendimientos(id);

-- Crear índices
CREATE INDEX idx_propiedades_tipo_operacion ON propiedades(tipo_operacion_id);
CREATE INDEX idx_propiedades_emprendimiento ON propiedades(emprendimiento_id);

-- Actualizar propiedades existentes con tipo alquiler por defecto
UPDATE propiedades 
SET tipo_operacion_id = (SELECT id FROM catalogo_tipo_operacion WHERE codigo = 'alquiler')
WHERE tipo_operacion_id IS NULL;
```

**Actualización de modelo Python:**
```python
# Agregar al modelo Propiedad
tipo_operacion_id: Optional[int] = Field(
    default=None, 
    foreign_key="catalogo_tipo_operacion.id",
    description="Tipo de operación principal de la propiedad"
)
tipo_operacion: Optional["CatalogoTipoOperacion"] = Relationship(back_populates="propiedades")

emprendimiento_id: Optional[int] = Field(
    default=None,
    foreign_key="emprendimientos.id",
    description="Emprendimiento al que pertenece"
)
emprendimiento: Optional["Emprendimiento"] = Relationship(back_populates="propiedades")

costo_propiedad: Optional[Decimal] = Field(
    default=None,
    sa_column=Column(DECIMAL(15, 2)),
    description="Costo de adquisición o construcción para cálculo de rentabilidad"
)

# Actualizar relaciones
oportunidades: List["Oportunidad"] = Relationship(back_populates="propiedad")
```

---

### 3.2 `vacancias`

**Nuevos campos:**

| Campo | Tipo | Restricciones | Descripción | Default |
|-------|------|---------------|-------------|---------|
| oportunidad_id | int | FK, NULL, index | Oportunidad que cerró este ciclo | NULL |

**Nuevas relaciones:**
- `oportunidad`: Many-to-One → `Oportunidad` (la que ganó y cerró el ciclo)

**Migración:**
```sql
-- Agregar columna
ALTER TABLE vacancias 
    ADD COLUMN oportunidad_id INTEGER NULL;

-- Agregar foreign key
ALTER TABLE vacancias
    ADD CONSTRAINT fk_vacancias_oportunidad 
        FOREIGN KEY (oportunidad_id) REFERENCES oportunidades(id);

-- Crear índice
CREATE INDEX idx_vacancias_oportunidad ON vacancias(oportunidad_id);
```

**Actualización de modelo Python:**
```python
# Agregar al modelo Vacancia
oportunidad_id: Optional[int] = Field(
    default=None,
    foreign_key="oportunidades.id",
    description="Oportunidad que cerró este ciclo de vacancia"
)
oportunidad: Optional["Oportunidad"] = Relationship(back_populates="vacancias")
```

---

## 4. ENTIDAD EMPRENDIMIENTO (Nueva)

### 4.1 `emprendimiento`

Registro de emprendimientos inmobiliarios (proyectos con múltiples unidades).

**Campos:**

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | int | PK, auto | Identificador |
| nombre | str(255) | NOT NULL, unique, index | Nombre del emprendimiento |
| descripcion | str(2000) | NULL | Descripción detallada |
| ubicacion | str(500) | NULL | Ubicación/dirección |
| estado | str(50) | NOT NULL, default="planificacion" | Estado del emprendimiento |
| fecha_inicio | date | NULL | Fecha de inicio del proyecto |
| fecha_fin_estimada | date | NULL | Fecha estimada de finalización |
| responsable_id | int | FK, NOT NULL | Usuario responsable |
| activo | bool | NOT NULL, default=True | Si está activo |
| created_at | datetime | NOT NULL, auto | Auditoría |
| updated_at | datetime | NOT NULL, auto | Auditoría |
| deleted_at | datetime | NULL | Soft delete |
| version | int | NOT NULL, default=1 | Optimistic locking |

**Hereda de:** `Base`

**Estados del emprendimiento (enum):**
```python
class EstadoEmprendimiento(str, Enum):
    PLANIFICACION = "planificacion"
    CONSTRUCCION = "construccion"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"
```

**Relaciones:**
- `responsable`: Many-to-One → `User`
- `propiedades`: One-to-Many → `Propiedad.emprendimiento`
- `oportunidades`: One-to-Many → `Oportunidad.emprendimiento`

**Metadata:**
```python
__tablename__ = "emprendimientos"
__searchable_fields__ = ["nombre", "descripcion", "ubicacion"]
__expanded_list_relations__ = {"responsable"}
```

**Seed Data:**
```python
[
    {
        "nombre": "Torres del Río",
        "descripcion": "Complejo de 3 torres con vista al río",
        "ubicacion": "Puerto Madero, Buenos Aires",
        "estado": "construccion",
        "fecha_inicio": "2024-03-01",
        "fecha_fin_estimada": "2026-12-31",
        "responsable_id": 1,
        "activo": True
    },
    {
        "nombre": "Barrio Cerrado Las Acacias",
        "descripcion": "50 lotes en barrio privado",
        "ubicacion": "Zona Norte",
        "estado": "planificacion",
        "fecha_inicio": "2025-06-01",
        "fecha_fin_estimada": "2027-06-30",
        "responsable_id": 1,
        "activo": True
    },
]
```

---

## 5. ORDEN DE CREACIÓN DE TABLAS

Para evitar problemas con foreign keys, el orden de creación debe ser:

1. **Catálogos independientes:**
   - `catalogo_tipo_operacion`
   - `catalogo_motivo_perdida`
   - `catalogo_condicion_pago`
   - `catalogo_tipo_evento`
   - `catalogo_motivo_evento`
   - `catalogo_origen_lead`
   - `catalogo_moneda`

2. **Cotizaciones:**
   - `cotizacion_moneda` (depende de `catalogo_moneda`)

3. **Emprendimientos:**
   - `emprendimiento` (depende de `users`)

4. **Modificar propiedades:**
   - Agregar columnas a `propiedades` (depende de `catalogo_tipo_operacion`, `emprendimiento`)

5. **Contactos:**
   - `contacto` (depende de `catalogo_origen_lead`, `users`)

6. **Oportunidades:**
   - `oportunidad` (depende de `contacto`, `catalogo_tipo_operacion`, `emprendimiento`, `propiedades`, `catalogo_motivo_perdida`, `catalogo_moneda`, `catalogo_condicion_pago`, `users`)

7. **Logs y eventos:**
   - `oportunidad_log_estado` (depende de `oportunidad`, `users`)
   - `evento` (depende de `contacto`, `catalogo_tipo_evento`, `catalogo_motivo_evento`, `users`, `oportunidad`, `catalogo_origen_lead`)

8. **Modificar vacancias:**
   - Agregar columna a `vacancias` (depende de `oportunidad`)

---

## 6. ÍNDICES Y PERFORMANCE

### 6.1 Índices críticos para performance

```sql
-- Búsquedas de contactos (deduplicación)
CREATE INDEX idx_contacto_email ON contactos(email) 
    WHERE email IS NOT NULL AND deleted_at IS NULL;

-- Dashboard comercial
CREATE INDEX idx_oportunidad_tipo_estado ON oportunidades(tipo_operacion_id, estado, created_at);
CREATE INDEX idx_oportunidad_estado_fecha ON oportunidades(estado, fecha_estado);
CREATE INDEX idx_oportunidad_responsable ON oportunidades(responsable_id, estado);

-- Timeline de eventos
CREATE INDEX idx_evento_contacto_fecha ON eventos(contacto_id, fecha_evento);
CREATE INDEX idx_evento_oportunidad_fecha ON eventos(oportunidad_id, fecha_evento) 
    WHERE oportunidad_id IS NOT NULL;

-- Seguimientos pendientes
CREATE INDEX idx_evento_estado_fecha ON eventos(estado_evento, fecha_compromiso)
    WHERE fecha_compromiso IS NOT NULL;

-- Búsqueda de cotizaciones vigentes
CREATE INDEX idx_cotizacion_moneda_lookup ON cotizacion_moneda(
    moneda_origen_id, moneda_destino_id, fecha_vigencia
);

-- Logs de oportunidad
CREATE INDEX idx_log_oportunidad_fecha ON oportunidad_log_estado(oportunidad_id, fecha_cambio);
```

### 6.2 Índices JSONB para telefonos en contacto

```sql
-- Si se necesita buscar por teléfono específico (PostgreSQL)
CREATE INDEX idx_contacto_telefonos ON contactos USING GIN (telefonos);
```

---

## 7. CONSTRAINTS Y VALIDACIONES A NIVEL BD

```sql
-- Validaciones en oportunidad
ALTER TABLE oportunidades 
    ADD CONSTRAINT chk_oportunidad_monto_positivo 
        CHECK (monto IS NULL OR monto >= 0);
    
ALTER TABLE oportunidades 
    ADD CONSTRAINT chk_oportunidad_probabilidad 
        CHECK (probabilidad IS NULL OR (probabilidad >= 0 AND probabilidad <= 100));

-- Validaciones en cotizacion_moneda
ALTER TABLE cotizacion_moneda 
    ADD CONSTRAINT chk_cotizacion_tipo_cambio_positivo 
        CHECK (tipo_cambio > 0);
    
ALTER TABLE cotizacion_moneda 
    ADD CONSTRAINT chk_cotizacion_monedas_diferentes 
        CHECK (moneda_origen_id != moneda_destino_id);

-- Validación en catalogo_moneda (solo una default)
CREATE UNIQUE INDEX idx_catalogo_moneda_default 
    ON catalogo_moneda(es_default) 
    WHERE es_default = true AND deleted_at IS NULL;

-- Validaciones en propiedades (nuevos campos)
ALTER TABLE propiedades 
    ADD CONSTRAINT chk_propiedades_costo_positivo 
        CHECK (costo_propiedad IS NULL OR costo_propiedad >= 0);
```

---

## 8. RESUMEN DE CAMBIOS

### Tablas nuevas: 14

**Catálogos (8):**
1. `catalogo_tipo_operacion`
2. `catalogo_motivo_perdida`
3. `catalogo_condicion_pago`
4. `catalogo_tipo_evento`
5. `catalogo_motivo_evento`
6. `catalogo_origen_lead`
7. `catalogo_moneda`
8. `cotizacion_moneda`

**Entidades principales (5):**
9. `emprendimiento`
10. `contacto`
11. `oportunidad`
12. `oportunidad_log_estado`
13. `evento`

**Tablas modificadas (2):**
14. `propiedades` (+ 3 columnas)
15. `vacancias` (+ 1 columna)

### Foreign Keys nuevas: 25

- Catálogos → Oportunidad: 5 FKs
- Catálogos → Contacto: 2 FKs
- Catálogos → Evento: 4 FKs
- Cotización → Monedas: 2 FKs
- Oportunidad → Entidades: 5 FKs
- Log → Oportunidad y User: 2 FKs
- Evento → Entidades: 5 FKs
- Propiedades → Catálogos: 2 FKs
- Vacancias → Oportunidad: 1 FK
- Emprendimiento → User: 1 FK

### Índices nuevos: 15+

Ver sección 6.1 para detalle completo.

---

**FIN - Especificación del Modelo de Datos CRM Oportunidades**
