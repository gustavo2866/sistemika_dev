from app.core.router import create_generic_router
from app.models.erp.cuenta_tipo import ErpCuentaTipo
from app.core.generic_crud import GenericCRUD

erp_cuenta_tipo_crud = GenericCRUD(ErpCuentaTipo)
erp_cuenta_tipo_router = create_generic_router(
    model=ErpCuentaTipo,
    crud=erp_cuenta_tipo_crud,
    prefix="/erp/cuenta-tipos",
    tags=["erp-cuenta-tipos"],
)
