from app.models.item import Item
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para Item
item_crud = GenericCRUD(Item)

# Crear router genérico para Item
item_router = create_generic_router(
    model=Item,
    crud=item_crud,
    prefix="/items",
    tags=["items"]
)

