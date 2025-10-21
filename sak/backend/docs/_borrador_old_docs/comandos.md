URLs y endpoints
===================================================
    URL base (local): http://127.0.0.1:8000/
    Health: http://127.0.0.1:8000/health
    Swagger UI (docs): http://127.0.0.1:8000/docs
    Redoc: http://127.0.0.1:8000/redoc
    
    Recursos de ejemplo (items) - Formato ra-data-json-server estándar:
    Listar: GET http://127.0.0.1:8000/items?_start=0&_end=10&_sort=id&_order=ASC
    (devuelve array directo + header X-Total-Count)
    Crear: POST http://127.0.0.1:8000/items
    (devuelve objeto directo)
    Leer: GET http://127.0.0.1:8000/items/{id}
    (devuelve objeto directo)
    Actualizar: PUT http://127.0.0.1:8000/items/{id}
    (devuelve objeto actualizado)
    Borrar: DELETE http://127.0.0.1:8000/items/{id}
    (devuelve objeto eliminado)

    Recursos de usuarios - Formato ra-data-json-server estándar:
    Listar: GET http://127.0.0.1:8000/users?_start=0&_end=10&_sort=id&_order=ASC
    Crear: POST http://127.0.0.1:8000/users
    Leer: GET http://127.0.0.1:8000/users/{id}
    Actualizar: PUT http://127.0.0.1:8000/users/{id}
    Borrar: DELETE http://127.0.0.1:8000/users/{id}


Cómo arrancar el servidor (PowerShell)
===================================================
python -m pip install -r requirements.txt
uvicorn app.main:app --reload


Migraciones y Base de Datos
===================================================
# Ejecutar migración inicial con datos de prueba
cd migrations
python 002_initial_dev_data.py    # Datos básicos (4 usuarios, 12 items)
python 003_add_more_items.py      # Items adicionales (+48 items)

# Migraciones con Alembic
cd alembic
alembic upgrade head              # Ejecutar todas las migraciones pendientes
alembic revision -m "nombre"      # Crear nueva migración
alembic current                   # Ver estado actual

# Base de datos actual: data/dev.db
# Datos después de todas las migraciones:
#   - 4 usuarios con datos realistas
#   - 79 items distribuidos entre usuarios (60 iniciales + 19 con Alembic)
#   - 16 categorías diferentes (Gaming, Fotografía, Móviles, etc.)
#   - Stock total: 694 unidades
#   - Valor inventario: €248,581.06
#   - Precio promedio: €593.36
#   - Rango precios: €39.99 - €3,899.99

# Para reset completo:
# python 002_initial_dev_data.py && python 003_add_more_items.py && alembic upgrade head
