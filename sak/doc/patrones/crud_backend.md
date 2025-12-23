# Patron CRUD backend (ejemplo: solicitudes)

Este patron describe el CRUD generico del backend usando `Solicitud` como ejemplo.

## Archivos base
- backend/app/core/generic_crud.py
- backend/app/core/nested_crud.py
- backend/app/core/router.py
- backend/app/models/solicitud.py
- backend/app/models/solicitud_detalle.py
- backend/app/routers/solicitud_router.py
- backend/app/main.py

## Flujo general
1. Definir el modelo SQLModel con campos, relaciones y metadatos de busqueda.
2. Crear el CRUD usando `GenericCRUD` o `NestedCRUD` si hay one-to-many embebido.
3. Registrar el router generico con `create_generic_router`.
4. Incluir el router en `app.main`.

## Ejemplo concreto: Solicitudes
Modelo principal: `backend/app/models/solicitud.py`
- Define `__searchable_fields__` para el filtro `q`.
- Relaciones: `solicitante`, `centro_costo`, `detalles`.

Modelo detalle: `backend/app/models/solicitud_detalle.py`
- Define `__searchable_fields__` y relacion `solicitud`.

CRUD anidado: `backend/app/routers/solicitud_router.py`
```python
solicitud_crud = NestedCRUD(
    Solicitud,
    nested_relations={
        "detalles": {
            "model": SolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,
        }
    },
)

solicitud_router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",
    tags=["solicitudes"],
)
```

Registro del router: `backend/app/main.py`
```python
app.include_router(solicitud_router)
```

## Endpoints genericos
- POST `/solicitudes`
- GET `/solicitudes`
- GET `/solicitudes/{id}`
- PUT `/solicitudes/{id}` (lock optimista con `version` si existe)
- PATCH `/solicitudes/{id}`
- DELETE `/solicitudes/{id}?hard=false`

## Payload con detalles (create/update)
```json
{
  "tipo_solicitud_id": 1,
  "departamento_id": 2,
  "estado": "pendiente",
  "total": 1200.5,
  "fecha_necesidad": "2025-01-15",
  "comentario": "Compra mensual",
  "solicitante_id": 10,
  "centro_costo_id": 3,
  "detalles": [
    {
      "articulo_id": 99,
      "descripcion": "Resmas A4",
      "unidad_medida": "caja",
      "cantidad": 2,
      "precio": 100.25,
      "importe": 200.5
    }
  ]
}
```

`NestedCRUD` sincroniza `detalles`:
- Si llega `id` en un item y existe, actualiza.
- Si no existe, crea nuevo.
- Si `allow_delete` es `True`, borra items no enviados (solo en update).

## Filtros y paginacion
`create_generic_router` soporta:
- `q` para texto usando `__searchable_fields__`.
- Filtros por query params (ej: `estado=pendiente`).
- `filter` (JSON) para ra-data-simple-rest; se aplana a claves como `relacion.campo`.
- Operadores con sufijo: `campo__gte`, `campo__lte`, `campo__in`, `campo__is`, `campo__like`.
- Paginacion con `sort`/`range` (ra-data-simple-rest) o `_start`/`_end` (json-server).
- Soft delete si el modelo tiene `deleted_at` y query `deleted=exclude|only|include`.

