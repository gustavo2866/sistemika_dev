from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.compras import PoOrderStatus

# CRUD genérico para estados de órdenes
po_order_status_crud = GenericCRUD(PoOrderStatus)

# Router genérico para estados de órdenes
po_order_status_router = create_generic_router(
    model=PoOrderStatus,
    crud=po_order_status_crud,
    prefix="/po-order-status",
    tags=["po-order-status"],
)