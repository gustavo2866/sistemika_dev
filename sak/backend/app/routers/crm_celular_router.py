"""
Router para gestión de celulares/canales de WhatsApp Business
"""
from fastapi import APIRouter
from app.core.ra_data_router import create_ra_data_router
from app.models import CRMCelular
from app.crud.crm_celular_crud import crm_celular_crud

# Crear router con patrón React Admin
router = create_ra_data_router(
    model=CRMCelular,
    crud=crm_celular_crud,
    prefix="/crm/celulares",
    tags=["crm-celulares"],
)
