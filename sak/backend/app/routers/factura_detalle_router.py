from app.models.factura_detalle import FacturaDetalle
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para FacturaDetalle
factura_detalle_crud = GenericCRUD(FacturaDetalle)

# Crear router genérico para FacturaDetalle
factura_detalle_router = create_generic_router(
    model=FacturaDetalle,
    crud=factura_detalle_crud,
    prefix="/factura-detalles",
    tags=["factura-detalles"]
)
