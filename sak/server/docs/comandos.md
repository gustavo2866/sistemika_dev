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


Cómo arrancar el servidor (PowerShell)
===================================================
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
