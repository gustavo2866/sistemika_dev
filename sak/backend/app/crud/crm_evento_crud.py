from app.core.generic_crud import GenericCRUD
from app.models import CRMEvento


# Instancia del CRUD genérico simple
crm_evento_crud = GenericCRUD(CRMEvento)
