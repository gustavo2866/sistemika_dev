from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.indice import ErpIndice


erp_indice_crud = GenericCRUD(ErpIndice)

erp_indice_router = create_generic_router(
    model=ErpIndice,
    crud=erp_indice_crud,
    prefix="/erp/indices",
    tags=["erp-indices"],
)
