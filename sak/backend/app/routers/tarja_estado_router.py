from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.tarja_estado import TarjaEstado

tarja_estado_crud = GenericCRUD(TarjaEstado)

tarja_estado_router = create_generic_router(
    model=TarjaEstado,
    crud=tarja_estado_crud,
    prefix="/tarja-estados",
    tags=["tarja-estados"],
)
