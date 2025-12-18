"""
CRUD para CRMCelular
"""
from app.core.generic_crud import GenericCRUD
from app.models import CRMCelular

# Instancia del CRUD genérico para CRMCelular
crm_celular_crud = GenericCRUD(CRMCelular)
