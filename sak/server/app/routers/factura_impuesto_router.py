from app.models.factura_impuesto import FacturaImpuesto
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para FacturaImpuesto
factura_impuesto_crud = GenericCRUD(FacturaImpuesto)

# Crear router genérico para FacturaImpuesto
factura_impuesto_router = create_generic_router(
    model=FacturaImpuesto,
    crud=factura_impuesto_crud,
    prefix="/factura-impuestos",
    tags=["factura-impuestos"]
)
