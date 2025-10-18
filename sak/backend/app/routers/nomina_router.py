from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.nomina import Nomina

# CRUD generico para Nomina
nomina_crud = GenericCRUD(Nomina)

# Router generico siguiendo el patron existente
nomina_router = create_generic_router(
    model=Nomina,
    crud=nomina_crud,
    prefix="/nominas",
    tags=["nominas"],
)
