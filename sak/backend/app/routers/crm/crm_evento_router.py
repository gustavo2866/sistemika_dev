from app.core.router import create_generic_router
from app.crud.crm_evento_crud import crm_evento_crud
from app.models import CRMEvento


crm_evento_router = create_generic_router(
    model=CRMEvento,
    crud=crm_evento_crud,
    prefix="/crm/eventos",
    tags=["crm-eventos"],
)
