from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.constructora.proyectos_conceptos import ProyectosConceptos

constructora_proyectos_conceptos_crud = GenericCRUD(ProyectosConceptos)

constructora_proyectos_conceptos_router = create_generic_router(
    model=ProyectosConceptos,
    crud=constructora_proyectos_conceptos_crud,
    prefix="/constructora/proyectos-conceptos",
    tags=["constructora-proyectos-conceptos"],
)
