"""
Router para Tipo de Artículo
"""
from app.models import TipoArticulo
from app.crud.tipo_articulo_crud import tipo_articulo_crud
from app.core.router import create_generic_router


tipo_articulo_router = create_generic_router(
    model=TipoArticulo,
    crud=tipo_articulo_crud,
    prefix="/tipos-articulo",
    tags=["tipos-articulo"],
)