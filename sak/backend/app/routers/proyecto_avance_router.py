from app.models.proyecto_avance import ProyectoAvance
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD generico para ProyectoAvance
proyecto_avance_crud = GenericCRUD(ProyectoAvance)

# Crear router generico
proyecto_avance_router = create_generic_router(
    model=ProyectoAvance,
    crud=proyecto_avance_crud,
    prefix="/proyecto-avance",
    tags=["proyecto-avance"]
)