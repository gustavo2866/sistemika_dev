import sys
sys.path.insert(0, '.')

from app.models.item import Item
from app.core.generic_crud import GenericCRUD
from app.db import get_session, init_db

# inicializar DB
init_db()

# crear CRUD
crud = GenericCRUD(Item)

# crear items de prueba
test_items = [
    {"name": "Item 1", "description": "Primera descripción"},
    {"name": "Item 2", "description": "Segunda descripción"},
    {"name": "Item DataProvider", "description": "Test del contrato DataProvider"},
]

try:
    with next(get_session()) as session:
        created_items = []
        for item_data in test_items:
            new_item = crud.create(session, item_data)
            created_items.append(new_item)
            print(f"Created: {new_item.name} (ID: {new_item.id})")
        
        print(f"\n✅ Created {len(created_items)} test items successfully!")
        
except Exception as e:
    import traceback
    print("ERROR:", e)
    traceback.print_exc()
