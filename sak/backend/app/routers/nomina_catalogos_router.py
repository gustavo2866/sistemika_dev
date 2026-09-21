from app.core.router import create_generic_router
from app.crud.nomina_catalogos_crud import nomina_categoria_crud, nomina_tarea_crud
from app.models.nomina_catalogos import NominaCategoria, NominaTarea


nomina_categoria_router = create_generic_router(
    model=NominaCategoria,
    crud=nomina_categoria_crud,
    prefix="/nomina-categorias",
    tags=["nomina-catalogos"],
)

nomina_tarea_router = create_generic_router(
    model=NominaTarea,
    crud=nomina_tarea_crud,
    prefix="/nomina-tareas",
    tags=["nomina-catalogos"],
)
