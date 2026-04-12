# Definición: Resource `contrato` (Inmobiliaria)

## 1. Objetivo

Crear el resource **Contrato** que represente de forma completa el contrato de alquiler
vigente (o histórico) entre un propietario y un inquilino sobre una propiedad concreta.
Centraliza los datos contractuales que hoy están dispersos en la entidad `Propiedad`, y
agrega los datos personales del inquilino, los garantes, los archivos adjuntos y el
template de cláusulas para generación de PDF.

---

## 2. Entidades nuevas

### 2.1 `TipoContrato` — Tabla `tipos_contrato`

Catálogo de tipos de contrato.  Los artículos se almacenan directamente como **JSONB**
en la columna `template`, ya que:

- El template se usa **una sola vez** por contrato, al momento de generar el PDF.
- Los artículos no tienen existencia independiente del tipo; son composición interna.
- JSONB permite estructuras de documento más ricas y reordenamiento trivial.
- No hay necesidad de consultas individuales sobre artículos.

```
tipos_contrato
  id               PK
  nombre           str(120)   — "Alquiler residencial 3 años", etc.
  descripcion      str(500)?
  activo           bool = True
  template         JSONB      — estructura del documento (ver esquema abajo)
  created_at / updated_at / deleted_at
```

#### 2.1.1 Esquema del campo `template` (JSONB)

```json
{
  "version": 1,
  "articulos": [
    {
      "numero": "PRIMERO",
      "titulo": "Objeto del contrato",
      "orden": 1,
      "texto": "Las partes acuerdan el alquiler del inmueble ubicado en <<propiedad.direccion>>, Ciudad Autónoma de Buenos Aires."
    },
    {
      "numero": "SEGUNDO",
      "titulo": "Duración",
      "orden": 2,
      "texto": "El plazo del presente contrato es de <<contrato.duracion_meses>> meses, con inicio el <<contrato.fecha_inicio>> y vencimiento el <<contrato.fecha_vencimiento>>."
    },
    {
      "numero": "TERCERO",
      "titulo": "Precio",
      "orden": 3,
      "texto": "El locatario <<inquilino.nombre_completo>>, DNI <<inquilino.dni>>, abonará la suma de $<<contrato.valor_alquiler>> mensuales, ajustables según <<contrato.tipo_actualizacion.nombre>>."
    },
    {
      "numero": "CUARTO",
      "titulo": "Garantía",
      "orden": 4,
      "texto": "El garante principal <<garante.1.nombre_completo>>, DNI <<garante.1.dni>>, con domicilio en <<garante.1.domicilio>>, garantiza las obligaciones del locatario."
    }
  ]
}
```

> El campo `version` permite evolucionar el esquema sin migraciones destructivas.
> El array `articulos` puede contener cualquier cantidad de ítems y estructuras
> adicionales (encabezados, secciones, bloques condicionales) a medida que el
> caso de uso lo requiera.

**Macros disponibles (referencia)**

| Macro | Descripción |
|---|---|
| `<<propiedad.nombre>>` | Nombre de la propiedad |
| `<<propiedad.direccion>>` | Dirección |
| `<<propietario.nombre_completo>>` | Nombre del propietario |
| `<<inquilino.nombre_completo>>` | Nombre y apellido del inquilino |
| `<<inquilino.dni>>` | DNI del inquilino |
| `<<garante.1.nombre_completo>>` | Nombre del garante principal |
| `<<garante.1.dni>>` | DNI del garante principal |
| `<<garante.2.nombre_completo>>` | Nombre del segundo garante |
| `<<contrato.fecha_inicio>>` | Fecha de inicio del contrato |
| `<<contrato.fecha_vencimiento>>` | Fecha de vencimiento |
| `<<contrato.valor_alquiler>>` | Monto mensual en letras |
| `<<contrato.tipo_actualizacion.nombre>>` | Tipo de actualización pactada |
| `<<contrato.duracion_meses>>` | Duración en meses |

> La lista de macros puede ampliarse; se resuelven en el servicio de generación de PDF.

---

### 2.2 `Contrato` — Tabla `contratos`

Entidad principal.  Un contrato pertenece a **una** propiedad.
Una propiedad puede tener múltiples contratos (histórico), pero solo uno activo a la vez.

```
contratos
  id                      PK
  propiedad_id            FK → propiedades.id        (required, index)
  tipo_contrato_id        FK → tipos_contrato.id      (optional, index)
  tipo_actualizacion_id   FK → tipos_actualizacion.id (optional)

  --- Vigencia ---
  fecha_inicio            date      (required)
  fecha_vencimiento       date      (required)
  fecha_renovacion        date?     — próxima renovación pactada
  duracion_meses          int?      — calculado o ingresado manualmente

  --- Económico ---
  valor_alquiler          float     (required, ≥ 0)
  expensas                float?    (≥ 0)
  deposito_garantia       float?    — monto del depósito de garantía
  moneda                  str(10) = "ARS"  — ARS | USD | etc.

  --- Inquilino ---
  inquilino_nombre        str(200)  (required)
  inquilino_apellido      str(200)  (required)
  inquilino_dni           str(20)
  inquilino_cuit          str(20)?
  inquilino_email         str(200)?
  inquilino_telefono      str(50)?
  inquilino_domicilio     str(300)?

  --- Garante 1 ---
  garante1_nombre         str(200)?
  garante1_apellido       str(200)?
  garante1_dni            str(20)?
  garante1_cuit           str(20)?
  garante1_email          str(200)?
  garante1_telefono       str(50)?
  garante1_domicilio      str(300)?
  garante1_tipo_garantia  str(100)?  — "Inmueble", "Recibo sueldo", "SGR", etc.

  --- Garante 2 (opcional) ---
  garante2_nombre         str(200)?
  garante2_apellido       str(200)?
  garante2_dni            str(20)?
  garante2_cuit           str(20)?
  garante2_email          str(200)?
  garante2_telefono       str(50)?
  garante2_domicilio      str(300)?
  garante2_tipo_garantia  str(100)?

  --- Estado y observaciones ---
  estado                  str(50) = "borrador"
                          — ver sección 2.4 para análisis completo de estados
  fecha_rescision         date?     — solo cuando estado = "rescindido"
  motivo_rescision        str(300)? — motivo opcional de rescisión
  contrato_renovado_id    FK → contratos.id (self-ref, nullable)
                          — apunta al nuevo contrato cuando estado = "renovado"
  observaciones           TEXT?

  created_at / updated_at / deleted_at
```

**Índices sugeridos**
- `(propiedad_id, estado)` — filtrar contrato vigente de una propiedad
- `(fecha_vencimiento)` — alertas de vencimiento próximo

---

### 2.4 Estados del contrato

#### Estados definidos

| Estado | Descripción |
|---|---|
| `borrador` | Contrato en edición, aún no activado. No afecta el dashboard ni el estado de la propiedad. |
| `vigente` | Contrato activo. `fecha_inicio ≤ hoy ≤ fecha_vencimiento`. La propiedad queda en estado `realizada`. |
| `por_vencer` | Contrato vigente cuya `fecha_vencimiento` está dentro de los próximos 60 días. Estado derivado (no persiste en DB, se calcula al consultar). |
| `vencido` | `fecha_vencimiento < hoy` y no hubo renovación. Transición automática. |
| `renovado` | El contrato fue reemplazado por uno nuevo. El campo `contrato_renovado_id` apunta al nuevo contrato. Terminal. |
| `rescindido` | Terminado anticipadamente. Requiere `fecha_rescision`. Puede incluir `motivo_rescision`. Terminal. |

> **`por_vencer` no se almacena**: se computa en el endpoint `/api/contratos` y en los
> selectors del dashboard. Esto evita inconsistencias y jobs de actualización.

#### Diagrama de transiciones

```
                  ┌──────────────────────────────────────┐
                  │              borrador                │
                  │  (en edición, sin efecto en sistema) │
                  └──────────────┬───────────────────────┘
                                 │ activar (manual)
                                 ▼
                  ┌──────────────────────────────────────┐
                  │              vigente                 │◄─────────────────┐
                  │   fecha_inicio ≤ hoy ≤ fecha_venc.  │                  │
                  └───────┬──────────────┬───────────────┘                  │
                          │              │                                   │
             vencimiento  │              │ acción manual                     │
             automático   │              │                                   │
                          ▼              ▼                                   │
               ┌──────────────┐  ┌─────────────────┐                        │
               │   vencido    │  │   rescindido    │         nuevo contrato  │
               │  (terminal)  │  │   (terminal)    │         creado          │
               └──────┬───────┘  └─────────────────┘                        │
                      │                                                      │
                      │ se crea nuevo contrato                               │
                      └──────────────────────────────────► renovado ─────────┘
                                                           (terminal,
                                                            contrato_renovado_id
                                                            → nuevo contrato)
```

#### Reglas de negocio

| Regla | Detalle |
|---|---|
| **Un solo vigente por propiedad** | Al activar un borrador, validar que no exista otro contrato `vigente` para la misma propiedad. |
| **Activación** | Pasar de `borrador` → `vigente` es una acción explícita (`POST /api/contratos/{id}/activar`), no automática al guardar. |
| **Vencimiento automático** | Un job diario (o cálculo on-the-fly al consultar) detecta contratos `vigente` con `fecha_vencimiento < hoy` y los pasa a `vencido`. |
| **Renovación** | Crear un nuevo contrato (en borrador) y al activarlo, el anterior pasa a `renovado` con `contrato_renovado_id` apuntando al nuevo. El sistema debe manejar esto como transacción atómica. |
| **Rescisión** | Acción manual. Requiere ingresar `fecha_rescision` (≤ hoy). El estado de la propiedad pasa a `disponible`. |
| **Borrador cancelado** | Un borrador que se descarta simplemente se elimina (soft-delete). No es un estado, no necesita transición. |
| **Efecto sobre `Propiedad.estado`** | Al activar → propiedad pasa a `realizada`. Al vencer/rescindir → propiedad pasa a `disponible` (si no hay otro vigente). |

#### Endpoint de transiciones

Además del CRUD estándar, agregar endpoints de acción explícita:

| Método | Ruta | Transición |
|---|---|---|
| POST | `/api/contratos/{id}/activar` | `borrador` → `vigente` |
| POST | `/api/contratos/{id}/rescindir` | `vigente` → `rescindido` (body: `fecha_rescision`, `motivo_rescision?`) |
| POST | `/api/contratos/{id}/renovar` | `vigente`/`vencido` → `renovado` + crea nuevo `borrador` |

> Los estados terminales (`vencido`, `rescindido`, `renovado`) **no son editables** una vez alcanzados. Solo se permiten consultas y visualización.

--- — Tabla `contratos_archivos`

Detalle de archivos adjuntos al contrato.  Los archivos físicos se almacenan en el
sistema de storage existente (`uploads/`).

```
contratos_archivos
  id              PK
  contrato_id     FK → contratos.id  (required, index)
  nombre          str(300)    — nombre descriptivo ("Contrato firmado", "DNI inquilino")
  tipo            str(100)?   — "contrato_firmado" | "dni" | "recibo_sueldo" | "garantia" | "otro"
  archivo_url     str(500)    — path relativo o URL del archivo almacenado
  mime_type       str(100)?   — "application/pdf", "image/jpeg", etc.
  tamanio_bytes   int?
  created_at / updated_at / deleted_at
```

---

## 3. Relaciones entre entidades

```
TipoContrato  1 ──< Contrato           (tipo_contrato_id)
Propiedad     1 ──< Contrato           (propiedad_id)
TipoActualizacion 1 ──< Contrato       (tipo_actualizacion_id)
Contrato      1 ──< ContratoArchivo    (contrato_id)
```

> `TipoContrato.template` (JSONB) contiene los artículos embebidos; no hay tabla
> separada `articulos_contrato`.

---

## 4. Migraciones Alembic (resumen)

Crear en orden:

1. `CREATE TABLE tipos_contrato`  (incluye columna `template JSONB`)
2. `CREATE TABLE contratos`
3. `CREATE TABLE contratos_archivos`

No se eliminan ni modifican columnas existentes en `propiedades` en esta etapa.
Migración posterior podrá rellenar `contratos` a partir de los datos existentes en
`propiedades` y luego deprecar esas columnas.

---

## 5. Backend — Routers y servicios

El backend usa el patrón `GenericCRUD` / `NestedCRUD` + `create_generic_router`
definido en `doc/patrones/crud_backend.md`.

### 5.1 `TipoContrato` — GenericCRUD simple

`backend/app/routers/tipo_contrato_router.py`

```python
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.tipo_contrato import TipoContrato

tipo_contrato_crud = GenericCRUD(TipoContrato)

tipo_contrato_router = create_generic_router(
    model=TipoContrato,
    crud=tipo_contrato_crud,
    prefix="/tipos-contrato",
    tags=["tipos-contrato"],
)
```

El campo `template` se serializa/deserializa directamente como JSON por SQLModel.
- Validar en capa de servicio (o validator del modelo) que cada artículo tenga
  `numero`, `titulo`, `orden` y `texto` antes de persistir.
- `PUT /api/tipos-contrato/{id}` reemplaza `template` completo; el frontend envía
  el array reordenado como parte del objeto.

### 5.2 `Contrato` — NestedCRUD + endpoints de transición

`backend/app/routers/contrato_router.py`

```python
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.contrato import Contrato
from app.models.contrato_archivo import ContratoArchivo

contrato_crud = NestedCRUD(
    Contrato,
    nested_relations={
        "archivos": {
            "model": ContratoArchivo,
            "fk_field": "contrato_id",
            "allow_delete": True,
        }
    },
)

contrato_router = create_generic_router(
    model=Contrato,
    crud=contrato_crud,
    prefix="/contratos",
    tags=["contratos"],
)

# Endpoints de transición (agregados al router luego del genérico)
@contrato_router.post("/{id}/activar")
def activar_contrato(id: int, session: Session = Depends(get_session)): ...

@contrato_router.post("/{id}/rescindir")
def rescindir_contrato(id: int, body: RescindirBody, session: Session = Depends(get_session)): ...

@contrato_router.post("/{id}/renovar")
def renovar_contrato(id: int, session: Session = Depends(get_session)): ...

@contrato_router.get("/{id}/pdf")
def descargar_pdf(id: int, session: Session = Depends(get_session)): ...
```

**Filtros soportados por `create_generic_router` (sin código extra)**
- `propiedad_id=1` — contratos de una propiedad
- `estado=vigente` — filtro por estado
- `fecha_vencimiento__lte=2026-06-30` — vencimiento hasta fecha (operador sufijo)
- `fecha_vencimiento__gte=2026-01-01` — vencimiento desde fecha

**Filtro adicional `por_vencer`** (requiere override en el router):
- Contratos `vigente` con `fecha_vencimiento ≤ hoy + 60 días`.
- Se implementa como query param extra, no como campo del modelo.

**Endpoints generados automáticamente por el patrón**

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/contratos` | Crear (estado inicial: `borrador`) |
| GET | `/api/contratos` | Lista paginada con filtros y ordenamiento |
| GET | `/api/contratos/{id}` | Detalle con `archivos` embebidos |
| PUT | `/api/contratos/{id}` | Editar (solo en estado `borrador`) |
| DELETE | `/api/contratos/{id}?hard=false` | Soft-delete |

**Endpoints adicionales (lógica de negocio)**

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/contratos/{id}/activar` | `borrador` → `vigente` |
| POST | `/api/contratos/{id}/rescindir` | `vigente` → `rescindido` |
| POST | `/api/contratos/{id}/renovar` | `vigente`/`vencido` → `renovado` + nuevo borrador |
| GET | `/api/contratos/{id}/pdf` | Generar y descargar PDF |

### 5.3 Upload de archivos

El upload multipart se agrega como endpoint adicional al `contrato_router`:

```python
@contrato_router.post("/{id}/archivos/upload")
async def upload_archivo(id: int, file: UploadFile, ...): ...
```

Sigue el patrón de upload existente en el proyecto (`uploads/`).
El `NestedCRUD` maneja la lista de archivos vía el array `archivos` en el payload
estándar de `PUT /contratos/{id}` (para actualizar nombre/tipo sin re-subir).

### 5.4 Servicio de generación de PDF

`backend/app/services/contrato_pdf.py`

Responsabilidades:
1. Cargar `Contrato` + `TipoContrato` (incluye `template` JSONB).
2. Extraer `template['articulos']`, ordenar por `orden`.
3. Construir el **contexto de macros**: dict plano con todas las claves resolubles
   (`propiedad.*`, `contrato.*`, `inquilino.*`, `garante.1.*`, `garante.2.*`, etc.).
4. Para cada artículo, aplicar `re.sub` sobre `texto` reemplazando `<<clave>>` con el
   valor del contexto (o string vacío si no existe).
5. Renderizar el documento (librería sugerida: `weasyprint` con template HTML/CSS,
   o `reportlab` si se prefiere programático).
6. Retornar bytes del PDF para el endpoint `GET /api/contratos/{id}/pdf`.

**Ejemplo de contexto de macros:**
```python
contexto = {
    "propiedad.nombre": contrato.propiedad.nombre,
    "propiedad.direccion": contrato.propiedad.domicilio or "",
    "inquilino.nombre_completo": f"{contrato.inquilino_nombre} {contrato.inquilino_apellido}",
    "inquilino.dni": contrato.inquilino_dni or "",
    "garante.1.nombre_completo": f"{contrato.garante1_nombre} {contrato.garante1_apellido}",
    "garante.1.dni": contrato.garante1_dni or "",
    "contrato.fecha_inicio": contrato.fecha_inicio.strftime("%d/%m/%Y"),
    "contrato.fecha_vencimiento": contrato.fecha_vencimiento.strftime("%d/%m/%Y"),
    "contrato.valor_alquiler": f"{contrato.valor_alquiler:,.2f}",
    "contrato.duracion_meses": str(contrato.duracion_meses or ""),
    "contrato.tipo_actualizacion.nombre": contrato.tipo_actualizacion.nombre if contrato.tipo_actualizacion else "",
}
```

---

## 6. Frontend — Resource `contratos`

Ruta: `frontend/src/app/resources/inmobiliaria/contratos/`

### 6.1 Archivos a crear

```
contratos/
  index.ts
  List.tsx
  create.tsx
  edit.tsx
  show.tsx
  form.tsx
  model.ts
```

### 6.2 Secciones del form

El form se organiza en secciones (patrón `SectionBaseTemplate`):

#### Sección: Propiedad y tipo de contrato
- `propiedad_id` → `ReferenceInput` a `propiedades`
- `tipo_contrato_id` → `ReferenceInput` a `tipos-contrato`
- `estado` → `FormSelect` (borrador / vigente / vencido / rescindido / renovado) — solo editable en borrador; en otros estados se muestra como badge

#### Sección: Vigencia y economía
- `fecha_inicio` / `fecha_vencimiento` / `fecha_renovacion`
- `duracion_meses` (calculado automáticamente desde las fechas)
- `valor_alquiler` / `expensas` / `deposito_garantia` / `moneda`
- `tipo_actualizacion_id` → `ReferenceInput` a `tipos-actualizacion`

#### Sección: Datos del inquilino
- `inquilino_nombre` / `inquilino_apellido` / `inquilino_dni` / `inquilino_cuit`
- `inquilino_email` / `inquilino_telefono` / `inquilino_domicilio`

#### Sección: Garante principal
- `garante1_nombre` / `garante1_apellido` / `garante1_dni` / `garante1_cuit`
- `garante1_email` / `garante1_telefono` / `garante1_domicilio`
- `garante1_tipo_garantia`

#### Sección: Garante secundario (colapsada por defecto)
- Mismos campos que garante 1 con prefijo `garante2_`

#### Sección: Observaciones
- `observaciones` → `FormTextarea`

#### Sección: Archivos adjuntos (solo en `edit` / `show`)
- Lista de `ContratoArchivo` del contrato
- Botón upload multipart
- Botón eliminar por archivo

### 6.3 List columns sugeridas

| Campo | Label |
|---|---|
| `id` | # |
| `propiedad.nombre` | Propiedad |
| `inquilino_nombre` + `inquilino_apellido` | Inquilino |
| `fecha_inicio` | Inicio |
| `fecha_vencimiento` | Vencimiento |
| `valor_alquiler` | Alquiler |
| `estado` | Estado |

### 6.4 Registro en el setup del módulo

Agregar en `inmobiliaria-setup-page.tsx` / `inmobiliariaSetupRegistry.tsx`:
- Resource `contratos` con el patrón estándar del módulo inmobiliaria.

---

## 7. Resource `tipos-contrato` (frontend admin)

Ruta: `frontend/src/app/resources/inmobiliaria/tipos-contrato/`

Form principal: `nombre`, `descripcion`, `activo`.

**Sub-sección artículos** (editor de `template.articulos`):
- El campo `template` se trata como estado local del formulario (array de objetos).
- Columnas editables por artículo: `numero`, `titulo`, `orden`, `texto` (textarea expandible).
- El texto admite macros `<<...>>`; mostrar panel de referencia con todas las macros disponibles.
- Ordenable por drag-and-drop o botones ↑/↓; el campo `orden` se recalcula automáticamente.
- Al guardar, el array se serializa a JSON y se envía como `template` en el payload.
- No se hacen llamadas individuales por artículo: es un único PUT del tipo completo.

---

## 8. Decisiones de diseño abiertas

| # | Pregunta | Opciones |
|---|---|---|
| 1 | ¿Migrar datos actuales de `propiedades` a `contratos`? | Script de migración de datos vs. convivencia temporal |
| 2 | ¿Un contrato por propiedad (único activo) o múltiples históricos? | Múltiples recomendado; campo `estado` diferencia |
| 3 | ¿Número de garantes fijo (2) o tabla separada `garantes`? | Fijo es simpler; tabla separada es más flexible |
| 4 | ¿Generación de PDF server-side o client-side? | Server-side con weasyprint recomendado |
| 5 | ¿Storage de archivos: local `uploads/` o bucket S3/GCS? | Seguir convención actual del proyecto |

---

## 9. Orden de implementación sugerido

1. **Modelos Python** + migración Alembic (`TipoContrato`, `Contrato`, `ContratoArchivo`)
2. **Router** `tipos-contrato` (CRUD + artículos anidados)
3. **Router** `contratos` (CRUD + upload archivos)
4. **Servicio PDF** básico (macros + weasyprint)
5. **Frontend** resource `tipos-contrato` (form con tabla inline de artículos)
6. **Frontend** resource `contratos` (form completo + upload archivos)
7. **Integración** con `Propiedad`: enlace rápido "Ver contratos" desde el form de propiedad
