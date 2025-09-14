from app.models.tipo_operacion import TipoOperacion
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para TipoOperacion
tipo_operacion_crud = GenericCRUD(TipoOperacion)

# Crear router genérico para TipoOperacion
tipo_operacion_router = create_generic_router(
    model=TipoOperacion,
    crud=tipo_operacion_crud,
    prefix="/tipos-operacion",
    tags=["tipos-operacion"]
)
