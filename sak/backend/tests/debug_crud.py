import sys
sys.path.insert(0, '.')

from app.models.item import Item
from app.core.generic_crud import GenericCRUD
from app.db import get_session, init_db

# inicializar DB
init_db()

# crear CRUD
crud = GenericCRUD(Item)

# probar operaciones
try:
    with next(get_session()) as session:
        print("Testing list...")
        items = crud.list(session)
        print(f"Items: {items}")
        
        print("Testing create...")
        new_item = crud.create(session, {"name": "test", "description": "test desc"})
        print(f"Created: {new_item}")
        
except Exception as e:
    import traceback
    print("ERROR:", e)
    traceback.print_exc()
