
# Contrato `dataProvider`

## Endpoints base
- `GET /api/v1/{resource}`
- `GET /api/v1/{resource}/{id}`
- `POST /api/v1/{resource}`
- `PUT /api/v1/{resource}/{id}`
- `DELETE /api/v1/{resource}/{id}`  
> `{resource}` ∈ `brand | model | product` (y futuros).

## Listado (`GET /{resource}`)
**Query params**
- `page` (int, ≥1) — default: `1`
- `perPage` (int, 1–100) — default: `25`
- `sortBy` (string, nombre de campo) — default: `created_at`
- `sortDir` (`asc|desc`) — default: `asc`
- `filter` (string JSON) — default: `{}`  
  
  Ejemplo:

filter={"brand_id":"abc","q":"iphone","price":{"gte":500,"lte":1200}}
- `fields` (csv, opcional) — proyección de campos (`id,title,price`)
- `include` (csv, opcional) — relaciones a embeber (`brand,model`)
- `deleted` (`include|only|exclude`) — default: `exclude` (soft delete)

**Operadores de filtro soportados**
- Igualdad: `{ "field": "value" }`
- Texto (búsqueda simple): `{ "q": "texto" }` → aplica a `sku|title|description` (case-insensitive)
- Conjunto: `{ "field": { "in": ["a","b"] } }`
- Rango / comparadores (número/fecha):
`{ "price": {"gte": 10, "lt": 100} }`,
`{ "created_at": {"gte":"2024-01-01T00:00:00Z"} }`
- Booleanos: `{ "featured": true }`
- Nulos: `{ "image_url": { "is": null } }`

**Respuesta (200)**
```json
{
"data": [ /* items */ ],
"total": 123
}

total = conteo con los mismos filtros, sin paginación.

Detalle (GET /{resource}/{id})
Respuesta (200)
{ "data": { /* item */ } }
Errores
404 si no existe o está deleted y deleted=exclude.

Crear (POST /{resource})
Body
{ /* campos del recurso (sin id ni timestamps) */ }
Respuesta (201)
{ "data": { /* item creado */ } }

Actualizar (PUT /{resource}/{id})
Body
{ "field": "value", "version": 1 }

Lock optimista
Enviar version actual del recurso.
Responder 409 Conflict si la versión no coincide.
Respuesta (200)
{ "data": { /* item actualizado */ } }

Eliminar (DELETE /{resource}/{id})
?hard=false → soft delete (default; setea deleted_at).
?hard=true → eliminación física.
Respuesta (200)
{ "data": true }

Errores (formato uniforme)
{
  "error": {
    "code": "NOT_FOUND|VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|CONFLICT|PAYLOAD_TOO_LARGE|UNSUPPORTED_MEDIA_TYPE",
    "message": "Texto legible",
    "details": {}
  }
}