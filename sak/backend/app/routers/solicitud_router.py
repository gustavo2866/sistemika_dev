from app.models.solicitud import Solicitud
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

solicitud_crud = GenericCRUD(Solicitud)

solicitud_router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",
    tags=["solicitudes"],
)
