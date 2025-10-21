from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.partediario import ParteDiario, ParteDiarioDetalle

# Define NestedCRUD for ParteDiario with its nested detalles

parte_diario_crud = NestedCRUD(
    ParteDiario,
    nested_relations={
        "detalles": {
            "model": ParteDiarioDetalle,
            "fk_field": "parte_diario_id",
            "allow_delete": True,
        }
    },
)

parte_diario_router = create_generic_router(
    model=ParteDiario,
    crud=parte_diario_crud,
    prefix="/parte-diario",
    tags=["parte-diario"],
)
