"""
Router genérico para el modelo Vacancia.
"""
from app.core.router import create_generic_router
from app.core.generic_crud import GenericCRUD
from app.models.vacancia import Vacancia

# Crear CRUD genérico
vacancia_crud = GenericCRUD(Vacancia)

# Crear router con factory
vacancia_router = create_generic_router(
    model=Vacancia,
    crud=vacancia_crud,
    prefix="/vacancias",
    tags=["vacancias"],
)
