from app.models.proyecto import Proyecto
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD generico para Proyecto
proyecto_crud = GenericCRUD(Proyecto)

# Crear router generico
proyecto_router = create_generic_router(
    model=Proyecto,
    crud=proyecto_crud,
    prefix="/proyectos",
    tags=["proyectos"]
)
