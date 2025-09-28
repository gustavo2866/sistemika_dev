from app.models.tipo_comprobante import TipoComprobante
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para TipoComprobante
_tipo_comprobante_crud = GenericCRUD(TipoComprobante)

# Crear router genérico para TipoComprobante
tipo_comprobante_router = create_generic_router(
    model=TipoComprobante,
    crud=_tipo_comprobante_crud,
    prefix="/tipos-comprobante",
    tags=["tipos-comprobante"],
)
