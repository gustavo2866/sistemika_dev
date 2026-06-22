from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.tarja import Tarja, TarjaDetalle, TarjaNovedad

tarja_crud = NestedCRUD(
    Tarja,
    nested_relations={
        "detalles": {
            "model": TarjaDetalle,
            "fk_field": "tarja_id",
            "allow_delete": True,
        },
        "novedades": {
            "model": TarjaNovedad,
            "fk_field": "tarja_id",
            "allow_delete": True,
        },
    },
)

tarja_router = create_generic_router(
    model=Tarja,
    crud=tarja_crud,
    prefix="/tarjas",
    tags=["tarjas"],
)
