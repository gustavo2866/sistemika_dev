from app.models.propiedad import Propiedad
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

propiedad_crud = GenericCRUD(Propiedad)

propiedad_router = create_generic_router(
    model=Propiedad,
    crud=propiedad_crud,
    prefix="/propiedades",
    tags=["propiedades"],
)
