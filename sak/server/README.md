Proyecto FastAPI + SQLModel (SQLite)

Archivos principales:
- `app/main.py`: arranca FastAPI y registra routers.
- `app/db.py`: configura la base de datos SQLite y la sesión.
- `app/models/base.py`: clase genérica `Base` con `id`, `created`, `updated` y utilidades.
- `app/crud/generic_crud.py`: implementación genérica CRUD reutilizable.
- `app/routers/generic_router.py`: router genérico que puede heredarse/instanciarse.
- `app/models/item.py` y `app/routers/item_router.py`: ejemplo de uso.

Instalación (PowerShell):

```powershell
python -m pip install -r requirements.txt
# para desarrollo
uvicorn app.main:app --reload
```

Notas:
- Validaciones esperadas en el frontend; los modelos incluyen utilidades para extraer metadatos `id/created/updated` y para crear un modelo de update con campos opcionales.
