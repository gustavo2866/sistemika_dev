from app.core.generic_crud import GenericCRUD
from app.models.nomina_catalogos import NominaCategoria, NominaTarea

nomina_categoria_crud = GenericCRUD(NominaCategoria)
nomina_tarea_crud = GenericCRUD(NominaTarea)
