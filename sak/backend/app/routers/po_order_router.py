from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.compras import PoOrder, PoOrderDetail

# CRUD con relación anidada para detalles de órdenes
po_order_crud = NestedCRUD(
    PoOrder,
    nested_relations={
        "detalles": {
            "model": PoOrderDetail,
            "fk_field": "order_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para órdenes
po_order_router = create_generic_router(
    model=PoOrder,
    crud=po_order_crud,
    prefix="/po-orders",
    tags=["po-orders"],
)
