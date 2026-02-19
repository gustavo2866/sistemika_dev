from app.core.router import create_generic_router
from app.core.generic_crud import GenericCRUD
from app.models.propiedad import PropiedadesLogStatus

# Router genérico para log de cambios de estado de propiedades
propiedades_log_status_router = create_generic_router(
    model=PropiedadesLogStatus,
    crud=GenericCRUD(PropiedadesLogStatus),
    prefix="/propiedades-log-status",
    tags=["propiedades-log-status"],
)