from app.models.item import Item
from app.models.base import campos_editables
from app.core.generic_crud import GenericCRUD
print('Item:', Item)
try:
    mf = getattr(Item, 'model_fields', None)
    print('Item.model_fields exists:', mf is not None)
    if mf is not None:
        print('model_fields keys:', list(Item.model_fields.keys()))
except Exception as e:
    print('error reading model_fields:', e)
try:
    ce = campos_editables(Item)
    print('campos_editables result:', ce)
except Exception as e:
    print('campos_editables error:', e)
    import traceback
    traceback.print_exc()

# Test CRUD creation
try:
    crud = GenericCRUD(Item)
    print('GenericCRUD created OK')
    test_data = {"name": "test", "description": "test desc", "id": 999, "creado_en": "2000-01-01"}
    cleaned = crud._clean_create(test_data)
    print('_clean_create result:', cleaned)
except Exception as e:
    print('CRUD test error:', e)
    import traceback
    traceback.print_exc()
