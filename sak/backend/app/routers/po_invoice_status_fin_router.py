from app.core.router import create_generic_router
from app.core.generic_crud import GenericCRUD
from app.models.compras import PoInvoiceStatusFin

# Router genérico para estados financieros de factura de compra (PO)
po_invoice_status_fin_router = create_generic_router(
    model=PoInvoiceStatusFin,
    crud=GenericCRUD(PoInvoiceStatusFin),
    prefix="/po-invoice-status-fin",
    tags=["po-invoice-status-fin"],
)