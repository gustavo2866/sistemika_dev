from app.models.proy_fase import ProyFase
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD generico para ProyFase
proy_fase_crud = GenericCRUD(ProyFase)

# Crear router generico
proy_fase_router = create_generic_router(
    model=ProyFase,
    crud=proy_fase_crud,
    prefix="/proy-fases",
    tags=["proy-fases"]
)
