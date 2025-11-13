from app.models.centro_costo import CentroCosto
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico
centro_costo_crud = GenericCRUD(CentroCosto)

# Crear router con factory
centro_costo_router = create_generic_router(
    model=CentroCosto,
    crud=centro_costo_crud,
    prefix="/centros-costo",
    tags=["centros-costo"],
)
