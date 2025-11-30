from fastapi import APIRouter

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models import TipoPropiedad

# Crear CRUD genérico
tipo_propiedad_crud = GenericCRUD(TipoPropiedad)

# Crear router con endpoints CRUD estándar
router = create_generic_router(
    model=TipoPropiedad,
    crud=tipo_propiedad_crud,
    prefix="/tipos-propiedad",
    tags=["tipos-propiedad"],
)
