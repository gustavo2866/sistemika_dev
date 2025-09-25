from app.models.proveedor import Proveedor
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para Proveedor
proveedor_crud = GenericCRUD(Proveedor)

# Crear router genérico para Proveedor
proveedor_router = create_generic_router(
    model=Proveedor,
    crud=proveedor_crud,
    prefix="/proveedores",
    tags=["proveedores"]
)
