from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.proyecto_encargado import ProyectoEncargado

proyecto_encargado_crud = GenericCRUD(ProyectoEncargado)

proyecto_encargado_router = create_generic_router(
    model=ProyectoEncargado,
    crud=proyecto_encargado_crud,
    prefix="/proyecto-encargados",
    tags=["proyecto-encargados"],
)
