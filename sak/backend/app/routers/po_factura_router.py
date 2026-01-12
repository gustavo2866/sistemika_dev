from app.crud.po_factura_crud import PoFacturaCRUD
from app.models.compras import PoFactura, PoFacturaDetalle, PoFacturaTotal
from app.core.router import create_generic_router

# CRUD con relaciones anidadas para detalles y totales de facturas
po_factura_crud = PoFacturaCRUD(
    PoFactura,
    nested_relations={
        "detalles": {
            "model": PoFacturaDetalle,
            "fk_field": "factura_id",
            "allow_delete": True,
        },
        "totales": {
            "model": PoFacturaTotal,
            "fk_field": "factura_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para facturas de compra (PO)
po_factura_router = create_generic_router(
    model=PoFactura,
    crud=po_factura_crud,
    prefix="/po-facturas",
    tags=["po-facturas"],
)
