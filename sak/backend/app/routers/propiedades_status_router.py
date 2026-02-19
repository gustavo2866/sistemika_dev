from app.core.router import create_generic_router
from app.core.generic_crud import GenericCRUD
from app.models.propiedad import PropiedadesStatus

# Router genérico para estados de propiedades
propiedades_status_router = create_generic_router(
    model=PropiedadesStatus,
    crud=GenericCRUD(PropiedadesStatus),
    prefix="/propiedades-status",
    tags=["propiedades-status"],
)