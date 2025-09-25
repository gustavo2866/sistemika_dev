from app.models.tarea import Tarea
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para Tarea
tarea_crud = GenericCRUD(Tarea)

# Crear router genérico para Tarea
tarea_router = create_generic_router(
    model=Tarea,
    crud=tarea_crud,
    prefix="/tareas",
    tags=["tareas"]
)
