from fastapi import APIRouter

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models import ServicioTipo

# Crear CRUD genérico
servicio_tipo_crud = GenericCRUD(ServicioTipo)

# Crear router con endpoints CRUD estándar
router = create_generic_router(
    model=ServicioTipo,
    crud=servicio_tipo_crud,
    prefix="/servicios-tipo",
    tags=["servicios-tipo"],
)
