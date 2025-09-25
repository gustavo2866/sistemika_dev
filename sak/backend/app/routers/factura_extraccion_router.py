from app.models.factura_extraccion import FacturaExtraccion
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# CRUD genérico para FacturaExtraccion
factura_extraccion_crud = GenericCRUD(FacturaExtraccion)

# Router genérico
factura_extraccion_router = create_generic_router(
    model=FacturaExtraccion,
    crud=factura_extraccion_crud,
    prefix="/facturas-extracciones",
    tags=["facturas-extracciones"],
)
