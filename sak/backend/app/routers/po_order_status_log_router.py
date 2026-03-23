from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.compras import PoOrderStatusLog

# CRUD genérico para log de estados de órdenes
po_order_status_log_crud = GenericCRUD(PoOrderStatusLog)

# Router genérico para log de estados de órdenes
po_order_status_log_router = create_generic_router(
    model=PoOrderStatusLog,
    crud=po_order_status_log_crud,
    prefix="/po-order-status-logs",
    tags=["po-order-status-logs"],
)
