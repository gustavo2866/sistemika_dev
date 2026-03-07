"""
Router para gestión de celulares/canales de WhatsApp Business
"""
from app.core.router import create_generic_router
from app.models import CRMCelular
from app.crud.crm_celular_crud import crm_celular_crud

# Router genérico compatible con ra-data-simple-rest (Content-Range)
router = create_generic_router(
    model=CRMCelular,
    crud=crm_celular_crud,
    prefix="/crm/celulares",
    tags=["crm-celulares"],
)
