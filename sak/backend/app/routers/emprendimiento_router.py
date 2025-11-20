from app.core.router import create_generic_router
from app.crud.emprendimiento_crud import emprendimiento_crud
from app.models import Emprendimiento


emprendimiento_router = create_generic_router(
    model=Emprendimiento,
    crud=emprendimiento_crud,
    prefix="/emprendimientos",
    tags=["crm-emprendimientos"],
)
