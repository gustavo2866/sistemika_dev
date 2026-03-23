from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.proyecto import Proyecto
from app.models.proyecto_avance import ProyectoAvance

# CRUD con relacion anidada para avances de proyecto
proyecto_crud = NestedCRUD(
    Proyecto,
    nested_relations={
        "avances": {
            "model": ProyectoAvance,
            "fk_field": "proyecto_id",
            "allow_delete": True,
        }
    },
)

# Crear router generico
proyecto_router = create_generic_router(
    model=Proyecto,
    crud=proyecto_crud,
    prefix="/proyectos",
    tags=["proyectos"],
)
