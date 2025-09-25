from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.pais import Paises

# Crear CRUD genérico para Paises
pais_crud = GenericCRUD(Paises)

# Crear router genérico para Paises
pais_router = create_generic_router(
    model=Paises,
    crud=pais_crud,
    prefix="/paises",
    tags=["paises"]
)