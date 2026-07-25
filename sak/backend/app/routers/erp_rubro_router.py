from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.erp.rubro import ErpRubro
from app.models.erp.cuenta import ErpCuenta

erp_rubro_crud = NestedCRUD(
    ErpRubro,
    nested_relations={
        "cuentas": {
            "model": ErpCuenta,
            "fk_field": "rubro_id",
            "allow_delete": True,
        }
    },
)

erp_rubro_router = create_generic_router(
    model=ErpRubro,
    crud=erp_rubro_crud,
    prefix="/erp/rubros",
    tags=["erp-rubros"],
)
