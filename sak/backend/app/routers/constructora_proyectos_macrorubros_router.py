from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.constructora.proyectos_macrorubros import ProyectosMacrorubros

constructora_proyectos_macrorubros_crud = GenericCRUD(ProyectosMacrorubros)

constructora_proyectos_macrorubros_router = create_generic_router(
    model=ProyectosMacrorubros,
    crud=constructora_proyectos_macrorubros_crud,
    prefix="/constructora/proyectos-macrorubros",
    tags=["constructora-proyectos-macrorubros"],
)
