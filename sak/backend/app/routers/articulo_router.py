from app.models.articulo import Articulo
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

articulo_crud = GenericCRUD(Articulo)

articulo_router = create_generic_router(
    model=Articulo,
    crud=articulo_crud,
    prefix="/articulos",
    tags=["articulos"],
)
