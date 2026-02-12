from app.core.router import create_generic_router
from app.core.generic_crud import GenericCRUD
from app.models.compras import PoInvoiceStatus

# Router genérico para estados de factura de compra (PO)
po_invoice_status_router = create_generic_router(
    model=PoInvoiceStatus,
    crud=GenericCRUD(PoInvoiceStatus),
    prefix="/po-invoice-status",
    tags=["po-invoice-status"],
)