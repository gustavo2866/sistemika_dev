# ESPECIFICACIÓN TÉCNICA BACKEND - CRM Oportunidades

> **Referencia funcional:** [20251119_oportunidades_req.md](./20251119_oportunidades_req.md)  
> **Patrones:** [README_BACKEND_PATTERNS_v1.md](../README_BACKEND_PATTERNS_v1.md)  
> **Fecha:** 2025-11-19  
> **Versión:** 1.0  

---

## 1. Modelo de datos

### 1.1 Nuevas entidades y catálogos (`backend/app/models`)

#### 1.1.1 Catálogos CRM (`crm_catalogos.py`)
- Contiene 7 modelos `CRMTipoOperacion`, `CRMMotivoPerdida`, `CRMCondicionPago`, `CRMTipoEvento`, `CRMMotivoEvento`, `CRMOrigenLead`, `Moneda`.
- Cada modelo hereda de `Base`, expone `codigo:str`, `nombre:str`, `descripcion:Optional[str]`, `activo:bool=True` y metadata `__tablename__`, `__searchable_fields__ = ["codigo","nombre"]`.
- `Moneda` agrega `simbolo:str(5)`, `es_moneda_base:bool` (uno solo en True).  
- Relaciones esperadas:
  - `CRMTipoOperacion.oportunidades`, `CRMMotivoPerdida.oportunidades`, `CRMCondicionPago.oportunidades`.
  - `CRMTipoEvento.eventos`, `CRMMotivoEvento.eventos`.
  - `CRMOrigenLead.contactos` y `.eventos`.
  - `Moneda.oportunidades_origen` y `.cotizaciones_origen/destino`.
- Crear datos seed mínimos (según requerimiento) en `scripts/seed_crm.py` para ambientes nuevos.

#### 1.1.2 `CotizacionMoneda` (`cotizacion_moneda.py`)
- Campos: `moneda_origen_id` FK, `moneda_destino_id` FK, `tipo_cambio` DECIMAL(18,6) obligatorio, `fecha_vigencia:date`, `fuente:str|None`.
- Unique `(moneda_origen_id, moneda_destino_id, fecha_vigencia)` e índice `idx_cotizacion_moneda_lookup` sobre los mismos campos para obtener la última cotización `<= fecha_referencia`.
- Relación Many-to-One hacia `Moneda` (origen/destino).  
- Validaciones: `tipo_cambio > 0`, `moneda_origen_id != moneda_destino_id`.

#### 1.1.3 `CRMContacto` (`crm_contacto.py`)
- Campos principales: `nombre_completo`, `telefonos:list[str]` (guardar como JSONB → `Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))`), `email`, `red_social`, `origen_lead_id`, `responsable_id`, `notas`.
- Validación: al menos un teléfono no vacío o email; normalizar teléfonos (trim) antes de persistir.
- Índices: `idx_contactos_email` (unique parcial cuando `deleted_at IS NULL`), `GIN` sobre `telefonos` cuando BD = PostgreSQL (dejar comentario para SQLite dev).
- Relaciones: `CRMContacto.oportunidades`, `CRMContacto.eventos`, `CRMContacto.responsable (User)`.

#### 1.1.4 `CRMOportunidad` (`crm_oportunidad.py`)
- Campos (además de FK vistas en requerimiento):
  - `estado` (string con prefijo numérico), `fecha_estado:datetime`, `monto:Decimal(15,2)`, `moneda_id`, `condicion_pago_id`, `probabilidad:int|None (0-100)`, `fecha_cierre_estimada:date|None`, `descripcion_estado:str|None`.
  - `cotizacion_aplicada:Decimal(18,6)|None` para dejar trazado el tipo de cambio usado cuando se convierta al monetizar estados finales.
- Relaciones Many-to-One hacia catálogos, CRMContacto, responsable (`User`), propiedad, emprendimiento.
- Metadata: `__searchable_fields__ = ["descripcion_estado"]`, `__expanded_list_relations__ = {"contacto","tipo_operacion","propiedad","moneda","condicion_pago","responsable"}`.

#### 1.1.5 `CRMOportunidadLogEstado` (`crm_oportunidad_log_estado.py`)
- Campos: `oportunidad_id`, `estado_anterior`, `estado_nuevo`, `descripcion:str`, `usuario_id`, `fecha_registro:datetime`, `motivo_perdida_id|None`, `monto|None`, `moneda_id|None`, `condicion_pago_id|None`.
- Registra toda transición, incluso reaperturas. Solo lectura desde API.
- Índice `idx_log_oportunidad_fecha (oportunidad_id, fecha_registro)`.

#### 1.1.6 `CRMEvento` (`crm_evento.py`)
- Campos: `contacto_id`, `tipo_id`, `motivo_id`, `fecha_evento`, `descripcion`, `asignado_a_id`, `oportunidad_id|None`, `origen_lead_id|None`, `proximo_paso|None`, `fecha_compromiso|None`, `estado_evento ("pendiente"/"hecho")`.
- Relaciona con contacto, oportunidad, catálogos y usuarios.
- Índices para timeline (contacto+fecha, oportunidad+fecha, estado_evento+fecha_compromiso) según spec_modelo.

#### 1.1.7 `Emprendimiento` (`emprendimiento.py`)
- Campos según tabla del modelo: `nombre`, `descripcion`, `ubicacion`, `estado` (enum `EstadoEmprendimiento`), `fecha_inicio`, `fecha_fin_estimada`, `responsable_id`, `activo`.
- Relaciones hacia `Propiedad` y `CRMOportunidad`.

### 1.2 Modificaciones a modelos existentes

#### 1.2.1 `Propiedad` (`backend/app/models/propiedad.py`)
- Agregar columnas opcionales:
  ```python
  tipo_operacion_id: int | None = Field(foreign_key="crm_tipo_operacion.id", default=None, index=True)
  emprendimiento_id: int | None = Field(foreign_key="emprendimientos.id", default=None, index=True)
  costo_propiedad: Decimal | None = Field(default=None, ge=0, sa_column=Column(DECIMAL(15,2)))
  costo_moneda_id: int | None = Field(foreign_key="monedas.id", default=None, description="Moneda del costo cargado")
  precio_venta_estimado: Decimal | None = Field(default=None, ge=0, sa_column=Column(DECIMAL(15,2)))
  precio_moneda_id: int | None = Field(foreign_key="monedas.id", default=None, description="Moneda del precio estimado")
  ```
- Relaciones: `tipo_operacion = Relationship(back_populates="propiedades")`, `emprendimiento = Relationship(back_populates="propiedades")`, `oportunidades = Relationship(back_populates="propiedad")`.
- Validaciones: cuando `tipo_operacion_id` no sea NULL, debe coincidir con las oportunidades generadas; si la propiedad pertenece a un emprendimiento, forzar que toda oportunidad ligada comparta ese `emprendimiento_id`. Si se informa un costo o precio de venta estimado se debe informar también la moneda correspondiente.

#### 1.2.2 `Vacancia` (`backend/app/models/vacancia.py`)
- Se mantiene sin relación directa con `CRMOportunidad`. Las vacancias dependen únicamente de la propiedad.
- Estados relevantes para propiedades destinadas a venta o alquiler:
  - `fecha_disponible`/`comentario_disponible`: indican que la unidad está en stock y puede recibir oportunidades. Se cargan desde la edición de estado de la propiedad cuando pasa a `3-disponible`.
  - `fecha_alquilada`/`comentario_alquilada`: se usan como “realizada” (representa operaciones cerradas tanto de alquiler como de venta). Se completan cuando la propiedad cambia automáticamente a `4-alquilada` tras una oportunidad ganada.
- `Vacancia` continúa registrando métricas (`dias_*`) y permitirá múltiples ciclos por propiedad sin guardar referencias a oportunidades específicas.

#### 1.2.3 Enumeraciones (`backend/app/models/enums.py`)
- Agregar:
  ```python
  class EstadoOportunidad(str, Enum): ...
  TRANSICIONES_ESTADO_OPORTUNIDAD = {...}

  class EstadoEvento(str, Enum): ...
  class EstadoEmprendimiento(str, Enum): ...
  ```
- Documentar que `EstadoPropiedad.RETIRADA` representa “vendida” para operaciones de venta/emprendimiento.

#### 1.2.4 Sincronización de estados Propiedad/Vacancia vs CRMOportunidad
- `Propiedad.estado = 3-disponible` + `Vacancia.fecha_disponible` marcan stock activo. Este estado se actualiza desde la edición manual de propiedades y habilita la creación o reapertura de oportunidades.
- Cuando una CRMOportunidad pasa a `5-ganada` se considera que la operación está realizada (alquiler o venta). El backend debe:
  - Cambiar la propiedad a `4-alquilada` (nombre actual hasta que se renombre a “realizada”).
  - Completar `Vacancia.fecha_alquilada`/`comentario_alquilada` con los datos del cierre.
- Si la CRMOportunidad termina en `6-perdida`, la propiedad se mantiene `3-disponible` y la vacancia activa sigue abierta sin cerrar el ciclo; se espera que se genere una nueva oportunidad sobre el mismo stock.
- Las vacancias de propiedades “en venta” reutilizan los mismos campos (`fecha_disponible`, `fecha_alquilada`) para representar estados “en stock” y “realizada” respectivamente, sin FKs hacia oportunidades.

#### 1.2.5 Responsabilidades de validación y transformación (Frontend vs Backend)
| Dominio | Frontend (`models.ts` + Zod) | Backend (SQLModel/Pydantic + servicios) |
|---------|------------------------------|-----------------------------------------|
| **Catálogos CRM / Moneda** | Validar campos requeridos, longitud máxima, normalizar mayúsculas/minúsculas para `codigo`. | Garantizar unicidad de códigos, consistencia de `es_moneda_base`, restricciones de eliminación (no permitir borrar moneda base ni catálogos usados). |
| **CRMContacto** | Formato de email/teléfonos, trimming y coerción de listas (por ejemplo convertir string a array), reglas de UI para campos obligatorios. | Deduplicación por email/teléfono, normalización final (quitar símbolos extra), relación con usuarios/origen lead, auditoría. |
| **CRMOportunidad** | Validar campos obligatorios por formulario (tipo operación, propiedad, estado inicial, moneda cuando se ingresa monto), parseo de fechas y montos antes de enviar. | Reglas de negocio (transiciones válidas, requisitos por estado, sincronización Propiedad/Vacancia, verificación de disponibilidad de la propiedad, forzar monedas y catálogos existentes). |
| **CRMEvento** | Formato de fechas (timezone UI), longitudes de texto, obligatoriedad de campos visibles, conversión de selects a IDs. | Lógica de creación automática de contacto/oportunidad, validación de tipos/motivos contra catálogos, actualización de estados de oportunidad cuando corresponda. |
| **Propiedad / Vacancia** | Frontend solo verifica que los campos numéricos/fechas tengan formato correcto y aplica máscaras básicas. | Backend controla coherencia de estados, nuevas columnas de costo/precio + moneda, creación/cierre de ciclos de vacancia y sincronía con oportunidades. |
| **Transformaciones generales** | Serializar payloads siguiendo los modelos Zod (por ejemplo `telefonos: string[]`, `fecha_estado` en ISO). | Convertir strings a `date/datetime`, garantizar integridad referencial, aplicar cálculos (métricas de vacancia, `_computed.monto_convertido`). |

Así evitamos duplicar lógica: el frontend ofrece validación inmediata y normalización mínima para mejorar UX, mientras que el backend mantiene las reglas del dominio y la consistencia de datos.

### 1.3 Ajustes globales
- Actualizar `backend/app/models/__init__.py` para exportar nuevos modelos y enums.
- Crear nuevos CRUDs (`backend/app/crud/*.py`) instanciando `GenericCRUD` para cada modelo: `crm_tipo_operacion_crud`, `crm_motivo_perdida_crud`, `crm_condicion_pago_crud`, `crm_tipo_evento_crud`, `crm_motivo_evento_crud`, `crm_origen_lead_crud`, `moneda_crud`, `cotizacion_moneda_crud`, `crm_contacto_crud`, `crm_oportunidad_crud`, `crm_oportunidad_log_crud` (solo lectura), `crm_evento_crud`, `emprendimiento_crud`.
- Servicios de soporte en `backend/app/services`:
  - `crm_contacto_service.py`: deduplicación (email/teléfono) y normalización.
  - `crm_oportunidad_service.py`: transición de estados, validación de reglas, sincronización con propiedades/vacancias.
  - `cotizacion_service.py`: resolver la última cotización efectiva y convertir montos.
- Mig raciones (orden recomendado):
  1. Crear catálogos CRM.
  2. Crear `emprendimientos`.
  3. Alter `propiedades` (nuevos FKs).
  4. Crear `contactos`.
  5. Crear `oportunidades`.
  6. Crear `crm_oportunidad_log_estado`.
  7. Crear `eventos`.
  8. Ajustar `vacancias` solo para nuevas métricas/índices (sin agregar columnas de referencia a oportunidades).
  9. Crear `cotizacion_moneda`.

---


### 1.4 Seed inicial por entidad
- **CRMTipoOperacion** (`crm_tipo_operacion`):
  ```json
  [
    {"codigo": "alquiler", "nombre": "Alquiler", "descripcion": "Operaciones de renta", "activo": true},
    {"codigo": "venta", "nombre": "Venta", "descripcion": "Operaciones de venta tradicional", "activo": true},
    {"codigo": "emprendimiento", "nombre": "Emprendimiento", "descripcion": "Preventas de proyectos", "activo": true}
  ]
  ```
- **CRMMotivoPerdida** (`crm_motivo_perdida`):
  ```json
  [
    {"codigo": "precio", "nombre": "Precio muy alto"},
    {"codigo": "ubicacion", "nombre": "Ubicaci?n no conveniente"},
    {"codigo": "estado", "nombre": "Estado de la propiedad"},
    {"codigo": "competencia", "nombre": "Eligi? otra opci?n"},
    {"codigo": "financiamiento", "nombre": "Sin financiamiento"},
    {"codigo": "desistio", "nombre": "Desisti?"},
    {"codigo": "no_responde", "nombre": "No responde"},
    {"codigo": "ya_vendida", "nombre": "Propiedad ya vendida/alquilada"},
    {"codigo": "otro", "nombre": "Otro motivo"}
  ]
  ```
- **CRMCondicionPago** (`crm_condicion_pago`):
  ```json
  [
    {"codigo": "contado", "nombre": "Contado"},
    {"codigo": "30_dias", "nombre": "30 d?as"},
    {"codigo": "60_dias", "nombre": "60 d?as"},
    {"codigo": "cuotas_3", "nombre": "3 cuotas"},
    {"codigo": "cuotas_6", "nombre": "6 cuotas"},
    {"codigo": "cuotas_12", "nombre": "12 cuotas"},
    {"codigo": "hipotecario", "nombre": "Cr?dito hipotecario"},
    {"codigo": "permuta", "nombre": "Permuta"},
    {"codigo": "otro", "nombre": "Otra condici?n"}
  ]
  ```
- **CRMTipoEvento** (`crm_tipo_evento`):
  ```json
  [
    {"codigo": "presencial", "nombre": "Presencial"},
    {"codigo": "whatsapp", "nombre": "WhatsApp"},
    {"codigo": "llamado", "nombre": "Llamado"},
    {"codigo": "mail", "nombre": "Email"},
    {"codigo": "redes", "nombre": "Redes sociales"}
  ]
  ```
- **CRMMotivoEvento** (`crm_motivo_evento`):
  ```json
  [
    {"codigo": "consulta", "nombre": "Consulta"},
    {"codigo": "visita", "nombre": "Visita a propiedad"},
    {"codigo": "oferta", "nombre": "Oferta / Contraoferta"},
    {"codigo": "seguimiento", "nombre": "Seguimiento"},
    {"codigo": "otros", "nombre": "Otros"}
  ]
  ```
- **CRMOrigenLead** (`crm_origen_lead`):
  ```json
  [
    {"codigo": "online", "nombre": "Online"},
    {"codigo": "referidos", "nombre": "Referidos"},
    {"codigo": "walk_in", "nombre": "Walk-in"},
    {"codigo": "campana", "nombre": "Campa?a"},
    {"codigo": "otros", "nombre": "Otros"}
  ]
  ```
- **Moneda** (`monedas`):
  ```json
  [
    {"codigo": "ARS", "nombre": "Peso Argentino", "simbolo": "$", "es_moneda_base": true},
    {"codigo": "USD", "nombre": "D?lar Estadounidense", "simbolo": "U$", "es_moneda_base": false},
    {"codigo": "EUR", "nombre": "Euro", "simbolo": "?", "es_moneda_base": false}
  ]
  ```
- **CotizacionMoneda** (`cotizacion_moneda`):
  ```json
  [
    {"moneda_origen_codigo": "USD", "moneda_destino_codigo": "ARS", "tipo_cambio": 875.00, "fecha_vigencia": "2025-11-18", "fuente": "BCRA"},
    {"moneda_origen_codigo": "EUR", "moneda_destino_codigo": "ARS", "tipo_cambio": 950.00, "fecha_vigencia": "2025-11-18", "fuente": "BCRA"},
    {"moneda_origen_codigo": "ARS", "moneda_destino_codigo": "USD", "tipo_cambio": 0.001142, "fecha_vigencia": "2025-11-18", "fuente": "BCRA"}
  ]
  ```
- **Emprendimiento** (`emprendimientos`):
  ```json
  [
    {
      "nombre": "Torres del R?o",
      "descripcion": "Complejo de 3 torres con vista al r?o",
      "ubicacion": "Puerto Madero, Buenos Aires",
      "estado": "construccion",
      "fecha_inicio": "2024-03-01",
      "fecha_fin_estimada": "2026-12-31",
      "responsable_id": 1
    },
    {
      "nombre": "Barrio Cerrado Las Acacias",
      "descripcion": "50 lotes en barrio privado",
      "ubicacion": "Zona Norte",
      "estado": "planificacion",
      "fecha_inicio": "2025-06-01",
      "fecha_fin_estimada": "2027-06-30",
      "responsable_id": 1
    }
  ]
  ```
- **CRMContacto** (`contactos`):
  ```json
  [
    {
      "nombre_completo": "Juan P?rez",
      "telefonos": ["+541122334455", "+541166778899"],
      "email": "juan.perez@example.com",
      "origen_lead_codigo": "online",
      "responsable_id": 1,
      "notas": "Consulta inicial por web"
    },
    {
      "nombre_completo": "Mar?a Gonz?lez",
      "telefonos": ["+541155667788"],
      "email": "maria.gonzalez@example.com",
      "origen_lead_codigo": "referidos",
      "responsable_id": 1,
      "notas": "Referido por cliente actual"
    }
  ]
  ```
- **CRMOportunidad** (`oportunidades`):
  ```json
  [
    {
      "contacto_ref": "Juan P?rez",
      "tipo_operacion_codigo": "alquiler",
      "propiedad_id": 1,
      "estado": "1-abierta",
      "fecha_estado": "2025-11-10T10:00:00Z",
      "responsable_id": 1,
      "descripcion_estado": "Consulta inicial por departamento Palermo"
    },
    {
      "contacto_ref": "Mar?a Gonz?lez",
      "tipo_operacion_codigo": "venta",
      "propiedad_id": 3,
      "estado": "2-visita",
      "fecha_estado": "2025-11-12T15:00:00Z",
      "monto": 250000,
      "moneda_codigo": "USD",
      "responsable_id": 1,
      "descripcion_estado": "Visita programada para el 15/11"
    }
  ]
  ```
- **CRMEvento** (`eventos`):
  ```json
  [
    {
      "contacto_ref": "Juan P?rez",
      "tipo_codigo": "presencial",
      "motivo_codigo": "consulta",
      "fecha_evento": "2025-11-10T10:00:00Z",
      "descripcion": "Cliente consult? por departamento de 2 ambientes",
      "asignado_a_id": 1,
      "oportunidad_ref": 1,
      "estado_evento": "hecho"
    },
    {
      "contacto_ref": "Mar?a Gonz?lez",
      "tipo_codigo": "whatsapp",
      "motivo_codigo": "visita",
      "fecha_evento": "2025-11-12T15:00:00Z",
      "descripcion": "Coordinar visita a oficina en Microcentro",
      "asignado_a_id": 1,
      "oportunidad_ref": 2,
      "proximo_paso": "Confirmar horario",
      "fecha_compromiso": "2025-11-14",
      "estado_evento": "pendiente"
    }
  ]
  ```
- **CRMOportunidadLogEstado**: no requiere seed; se genera con cada transici�n.
- **Vacancia**: se respeta data existente. La sincronizaci�n se realiza actualizando los campos del ciclo activo (disponible/alquilada) seg�n el estado de la propiedad, sin guardar referencias directas a oportunidades.


## 2. Endpoints y CRUD

### 2.1 Catálogos CRM
- Crear routers genéricos (`create_generic_router`) para cada catálogo con prefijo `/crm/catalogos/...` y tag específico.

| Router | Prefijo | Notas |
|--------|---------|-------|
| `crm_tipo_operacion_router` | `/crm/catalogos/tipos-operacion` | CRUD completo, único campo `codigo`. |
| `crm_motivo_perdida_router` | `/crm/catalogos/motivos-perdida` | CRUD completo. |
| `crm_condicion_pago_router` | `/crm/catalogos/condiciones-pago` | CRUD completo. |
| `crm_tipo_crm_evento_router` | `/crm/catalogos/tipos-evento` | CRUD completo. |
| `crm_motivo_crm_evento_router` | `/crm/catalogos/motivos-evento` | CRUD completo. |
| `crm_origen_lead_router` | `/crm/catalogos/origenes-lead` | CRUD completo. |
| `moneda_router` | `/crm/catalogos/monedas` | CRUD completo; restringir eliminación de la moneda base. |
| `cotizacion_moneda_router` | `/crm/cotizaciones` | CRUD completo + filtros `moneda_origen_id`, `moneda_destino_id`. |

### 2.2 Emprendimientos
- Router: `/crm/emprendimientos`.
- Endpoints generados con `create_generic_router`.
- Validaciones adicionales en CRUD:
  - `nombre` único (case-insensitive).
  - `fecha_fin_estimada >= fecha_inicio` cuando ambos existen.
- Filtros soportados: `estado`, `responsable_id`, `activo`.

### 2.3 CRMContactos
- Router: `/crm/contactos`.
- `CRMContactoCRUD.create` sobreescribe `GenericCRUD.create`:
  1. Normaliza teléfonos (elimina espacios, símbolos no numéricos salvo `+`).
  2. Si email presente → buscar coincidencia exacta (case-insensitive).
  3. Si no hay email o no coincide → buscar primer teléfono exacto (usando JSON_CONTAINS en MySQL o `telefonos @> '["..."]'` en PostgreSQL; en SQLite fallback a `LIKE` simple).
  4. Si existe contacto activo → retornar registro (sin crear).  
     - Registrar un log interno para auditoría (por ahora basta con `logger.info`).
  5. Si no existe → crear normalmente.
- `POST /crm/contactos/buscar` (passthrough a `GenericCRUD.list` con filtros `q`, `telefono`). Solo este endpoint extra se añade porque la búsqueda por teléfono requiere JSON. Recibe payload `{"telefono": "1155667788"}` y devuelve el primer match.
- `GET /crm/contactos/{id}/timeline`: reutiliza listado de `CRMEventos` filtrando por `contacto_id` (no se crea endpoint nuevo; frontend usa `GET /crm/eventos?filter={"contacto_id":id}`).

### 2.4 CRMOportunidades
- Router: `/crm/oportunidades`.
- CRUD base (create, list, retrieve, update, delete) generado por `create_generic_router` utilizando `crm_oportunidad_crud` (extiende `GenericCRUD` para inyectar lógica en `create`/`update`).
- Reglas en `create`/`update`:
  1. Validar `tipo_operacion_id` contra catálogo y que la `propiedad` seleccionada tenga `tipo_operacion_id` compatible; si la propiedad está asociada a un `emprendimiento`, forzar `emprendimiento_id`.
  2. Estado inicial obligatorio `1-abierta`, `fecha_estado = now()`, crear log.
  3. Si `tipo_operacion` = alquiler → verificar `Propiedad.estado == 3-disponible`. Para venta/emprendimiento se permite `1-recibida` o `3-disponible`.
- Endpoint adicional `POST /crm/oportunidades/{id}/cambiar-estado`:
  - Payload:
    ```json
    {
      "nuevo_estado": "3-cotiza",
      "descripcion": "Se envió propuesta",
      "motivo_perdida_id": null,
      "monto": 250000,
      "moneda_id": 2,
      "condicion_pago_id": 1,
      "fecha_estado": "2025-11-20T10:30:00Z"
    }
    ```
  - `crm_oportunidad_service.cambiar_estado` valida transición (`TRANSICIONES_ESTADO_OPORTUNIDAD`) y reglas:
    - Perdida → requiere `motivo_perdida_id`.
    - Reserva/Ganada → requieren `monto`, `moneda_id`, `condicion_pago_id`.
    - Siempre `descripcion`.
  - Acciones:
    1. Actualizar registro principal (`estado`, `fecha_estado`, etc.).
    2. Insertar fila en `CRMOportunidadLogEstado`.
    3. Sincronizar Propiedad/Vacancia (sin FK a la oportunidad):
       - `5-ganada`: setear `Propiedad.estado = 4-alquilada` (estado “realizada” temporal), completar `Vacancia.fecha_alquilada`/`comentario_alquilada` con la información del cierre y finalizar el ciclo activo.
       - `6-perdida`: dejar la propiedad en `3-disponible`; la vacancia activa continúa abierta (no se genera ciclo nuevo) y la unidad permanece en stock para futuras oportunidades.
       - Reapertura (`nuevo_estado = 1-abierta`) u otros cambios que vuelvan la unidad a stock deben establecer `Propiedad.estado = 3-disponible`. Si el ciclo previo había cerrado, crear una nueva vacancia; si seguía abierto, actualizar `fecha_disponible`/`comentario_disponible`.
       - Luego de marcar una oportunidad como ganada, forzar que el resto de oportunidades abiertas de la misma propiedad pasen a `6-perdida` con motivo `ya_vendida`.
  - Respuesta: objeto oportunidad actualizado + `{"logs": [...]}` opcional.
- Endpoint `GET /crm/oportunidades/{id}/logs`:
  - Devuelve los registros de `CRMOportunidadLogEstado` (orden DESC). Se implementa router específico (`crm_oportunidad_log_router`) con solo `list`/`retrieve`.
- Conversión de montos:
  - `GET /crm/oportunidades` acepta `moneda_destino` (código o id) y `fecha_referencia` (fecha, default = `fecha_estado` de cada registro).  
  - `crm_oportunidad_crud.list` utiliza `cotizacion_service.obtener_cotizacion(moneda_origen_id, moneda_destino_id, fecha_referencia)` y agrega a la respuesta `_computed: {"monto_convertido": 1234.5, "moneda_destino": "USD"}`.  
  - Si no hay cotización, `_computed["monto_convertido"] = None` y `_computed["cotizacion_error"] = "sin_cotizacion"`.

### 2.5 Logs de CRMOportunidad
- Router: `/crm/oportunidades/logs`.
- Solo `GET` (list y retrieve). No se exponen `POST/PUT/DELETE`; la creación ocurre únicamente desde `crm_oportunidad_service`.
- Permite filtros `oportunidad_id`, `estado_nuevo`, rangos de fechas.

### 2.6 CRMEventos
- Router: `/crm/eventos`.
- CRUD base extendido (`CRMEventoCRUD`) con lógica en `create`:
  1. Reutiliza `crm_contacto_service.obtener_o_crear` cuando no llega `contacto_id`.
  2. Si no hay `oportunidad_id` pero el payload trae `tipo_operacion_id` y `propiedad_id`, invoca `crm_oportunidad_service.crear_desde_evento` que genera una oportunidad `1-abierta`.
  3. Permite opcionalmente `nuevo_estado_oportunidad`. Si se envía, llama internamente a `crm_oportunidad_service.cambiar_estado` antes de guardar el evento (para mantener consistencia).
  4. Persiste el evento y devuelve la respuesta expandida (contacto, oportunidad, tipo, motivo).
- `PATCH /crm/eventos/{id}` permite actualizar `estado_evento`, `fecha_compromiso`, `proximo_paso`.
- Validaciones:
  - `fecha_evento` en timezone UTC-3 (convertir a UTC al guardar).
  - `estado_evento` solo `pendiente`/`hecho`.

### 2.7 Cotizaciones / Conversión
- Además del CRUD genérico de `CotizacionMoneda`, agregar endpoint liviano:
  - `GET /crm/cotizaciones/convertir?monto=1000&moneda_origen=USD&moneda_destino=ARS&fecha=2025-11-19`
  - Usa el mismo servicio de conversión y responde:
    ```json
    {
      "monto_convertido": 875000,
      "tipo_cambio": 875.0,
      "fecha_aplicada": "2025-11-18",
      "fuente": "BCRA"
    }
    ```
  - Este endpoint se reutiliza también por el dashboard.

### 2.8 Integración con endpoints existentes
- `propiedad_router`:
  - Exponer nuevos campos `tipo_operacion_id`, `emprendimiento_id`, `costo_propiedad`.
  - Validar en `cambiar_estado_propiedad` que no pueda pasarse a `4-alquilada` si existe una oportunidad abierta tipo venta/emprendimiento en estado avanzado (Cotiza o más). Se delega en `crm_oportunidad_service`.
  - Agregar `GET /propiedades/{id}/oportunidades` reutilizando `/crm/oportunidades?filter={"propiedad_id":id}` (no endpoint nuevo).
- `vacancia_router`:
  - Continuar exponiendo ciclos por propiedad sin referencias a oportunidades.
  - La API de cambios de estado de propiedad debe poder actualizar `fecha_disponible`/`fecha_alquilada` del ciclo activo para sincronizar con CRMOportunidades ganadas o reabiertas.

### 2.9 Registro de routers (FastAPI)
- Registrar todos los routers nuevos en `app/main.py` debajo del bloque CRM:
  ```python
  from app.routers.crm import (
      crm_tipo_operacion_router,
      ...,
      crm_contacto_router,
      crm_oportunidad_router,
      crm_oportunidad_log_router,
      crm_evento_router,
      emprendimiento_router,
      cotizacion_router,
  )
  ```
- Crear paquete `app/routers/crm/__init__.py` que agrupe importaciones para mantener orden.

---

## 3. Reglas clave aplicables desde los endpoints

1. **Deduplicación**: CRMContactos y CRMOportunidades se buscan por `email/telefonos` y `propiedad_id + estado` respectivamente antes de crear nuevos registros para evitar duplicados.
2. **Integridad referencial**: toda CRMOportunidad debe cumplir `tipo_operacion_id` válido, `propiedad_id` existente y `responsable_id` (usuario). Se usan FK y validaciones en CRUD.
3. **Sincronización con vacancias**: cualquier API que cambie estados (CRMOportunidades o propiedades) debe invocar `crm_oportunidad_service.sync_propiedad_vacancia` para mantener `Vacancia` y `Propiedad.estado`, siguiendo las reglas “en stock” (`3-disponible` + `fecha_disponible`) y “realizada” (`4-alquilada` + `fecha_alquilada`) descritas en la sección 1.2.4.
4. **Moneda**: siempre persistimos montos en la moneda seleccionada. Los endpoints pueden devolver `_computed.monto_convertido` cuando se solicita `moneda_destino`. La conversión usa `CotizacionMoneda` y, si no hay cotización válida, marca el registro como N/A.
5. **Auditoría**: `CRMOportunidadLogEstado` y `CRMEvento` guardan `usuario_id` y `fecha_registro`. No se exponen endpoints de edición/eliminación sobre logs.

Este documento cubre todos los cambios necesarios sobre el modelo de datos y los endpoints del backend para implementar el módulo CRM solicitado aplicando el patrón CRUD existente y limitando los cambios a los endpoints estrictamente requeridos.


---

## 4. Esquema entidad-relaci?n (vista resumida)

```
CRMOrigenLead   CRMTipoEvento   CRMMotivoEvento
       \             |               /
        \            |              /
         >------ CRMEvento ------< Usuario(asignado_a)
         |           |
CRMContacto |        | (opcional)
    \       |        v
     \      |     CRMOportunidad ---- CRMTipoOperacion
      \     |             | \
       \    |             |  \__ CRMMotivoPerdida (estado perdida)
        \   |             |_____ CRMCondicionPago (cuando aplica)
         |  |
         |  v
         | CRMOportunidadLogEstado
         |
         v
      Propiedad ---- Emprendimiento
         |
         v
      Vacancia (ciclos de stock sin FK a oportunidades)

Otras relaciones:
- CRMOportunidad -> Moneda y CotizacionMoneda
- CRMContacto/CRMOportunidad/CRMEvento -> User (responsables)
- Propiedad -> CRMTipoOperacion (operaci?n principal)
```






