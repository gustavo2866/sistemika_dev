from app.models.compras import PoOrdenCompra, PoOrdenCompraDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

# CRUD con relación anidada para detalles de órdenes de compra
po_orden_compra_crud = NestedCRUD(
    PoOrdenCompra,
    nested_relations={
        "detalles": {
            "model": PoOrdenCompraDetalle,
            "fk_field": "orden_compra_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para órdenes de compra (PO)
po_orden_compra_router = create_generic_router(
    model=PoOrdenCompra,
    crud=po_orden_compra_crud,
    prefix="/po-ordenes-compra",
    tags=["po-ordenes-compra"],
)