"""
CRUD para Departamento
"""
from app.core.generic_crud import GenericCRUD
from app.models import Departamento


# Instancia del CRUD genérico para Departamento
departamento_crud = GenericCRUD(Departamento)
