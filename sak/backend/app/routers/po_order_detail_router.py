from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.compras import PoOrderDetail

# CRUD genérico para detalles de órdenes
po_order_detail_crud = GenericCRUD(PoOrderDetail)

# Router genérico para detalles de órdenes
po_order_detail_router = create_generic_router(
    model=PoOrderDetail,
    crud=po_order_detail_crud,
    prefix="/po-order-details",
    tags=["po-order-details"],
)