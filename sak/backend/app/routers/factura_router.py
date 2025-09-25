from app.models.factura import Factura
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para Factura
factura_crud = GenericCRUD(Factura)

# Crear router genérico para Factura
factura_router = create_generic_router(
    model=Factura,
    crud=factura_crud,
    prefix="/facturas",
    tags=["facturas"]
)
