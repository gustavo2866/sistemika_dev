from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.empresa import ErpEmpresa


erp_empresa_crud = GenericCRUD(ErpEmpresa)

erp_empresa_router = create_generic_router(
    model=ErpEmpresa,
    crud=erp_empresa_crud,
    prefix="/erp/empresas",
    tags=["erp-empresas"],
)
