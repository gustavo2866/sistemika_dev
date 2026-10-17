from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.metodo_proyeccion import MetodoProyeccion, MetodoProyeccionCuenta, MetodoProyeccionDetalle

metodo_proyeccion_crud = NestedCRUD(
    MetodoProyeccion,
    nested_relations={
        "detalles": {
            "model": MetodoProyeccionDetalle,
            "fk_field": "id_metodo_proyeccion",
            "allow_delete": True,
        },
        "cuentas": {
            "model": MetodoProyeccionCuenta,
            "fk_field": "id_metodo_proyeccion",
            "allow_delete": True,
        },
    },
)

metodo_proyeccion_router = create_generic_router(
    model=MetodoProyeccion,
    crud=metodo_proyeccion_crud,
    prefix="/metodos-proyeccion",
    tags=["metodos-proyeccion"],
)
