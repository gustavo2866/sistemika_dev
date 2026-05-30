from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.parte_diario_estado import ParteDiarioEstado

parte_diario_estado_crud = GenericCRUD(ParteDiarioEstado)

parte_diario_estado_router = create_generic_router(
    model=ParteDiarioEstado,
    crud=parte_diario_estado_crud,
    prefix="/parte-diario-estados",
    tags=["parte-diario-estados"],
)
