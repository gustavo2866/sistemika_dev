from app.core.router import create_generic_router
from app.models.tipo_actualizacion import TipoActualizacion
from app.crud.tipo_actualizacion_crud import tipo_actualizacion_crud

tipo_actualizacion_router = create_generic_router(
    model=TipoActualizacion,
    crud=tipo_actualizacion_crud,
    prefix="/tipos-actualizacion",
    tags=["tipos-actualizacion"],
)