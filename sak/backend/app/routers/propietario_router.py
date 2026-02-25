from app.core.router import create_generic_router
from app.models.propietario import Propietario
from app.crud.propietario_crud import propietario_crud

propietario_router = create_generic_router(
    model=Propietario,
    crud=propietario_crud,
    prefix="/propietarios",
    tags=["propietarios"],
)