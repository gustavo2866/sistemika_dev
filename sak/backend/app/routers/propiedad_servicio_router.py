from fastapi import APIRouter

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models import PropiedadServicio

# Crear CRUD genérico
propiedad_servicio_crud = GenericCRUD(PropiedadServicio)

# Crear router con endpoints CRUD estándar
router = create_generic_router(
    model=PropiedadServicio,
    crud=propiedad_servicio_crud,
    prefix="/propiedades-servicios",
    tags=["propiedades-servicios"],
)
