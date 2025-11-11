"""
Router para Tipo de Solicitud
"""
from app.models import TipoSolicitud
from app.crud.tipo_solicitud_crud import tipo_solicitud_crud
from app.core.router import create_generic_router


tipo_solicitud_router = create_generic_router(
    model=TipoSolicitud,
    crud=tipo_solicitud_crud,
    prefix="/tipos-solicitud",
    tags=["tipos-solicitud"],
)
