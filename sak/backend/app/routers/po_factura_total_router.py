from app.core.router import create_generic_router
from app.crud.po_factura_total_crud import po_factura_total_crud
from app.models.compras import PoFacturaTotal

po_factura_total_router = create_generic_router(
    model=PoFacturaTotal,
    crud=po_factura_total_crud,
    prefix="/po-factura-totales",
    tags=["po-factura-totales"],
)
