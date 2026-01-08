from app.models.compras import PoFactura, PoFacturaDetalle, PoFacturaImpuesto
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

# CRUD con relaciones anidadas para detalles e impuestos de facturas
po_factura_crud = NestedCRUD(
    PoFactura,
    nested_relations={
        "detalles": {
            "model": PoFacturaDetalle,
            "fk_field": "factura_id",
            "allow_delete": True,
        },
        "impuestos": {
            "model": PoFacturaImpuesto,
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