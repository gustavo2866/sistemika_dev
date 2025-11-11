"""
Router para Departamento
"""
from app.models import Departamento
from app.crud.departamento_crud import departamento_crud
from app.core.router import create_generic_router


departamento_router = create_generic_router(
    model=Departamento,
    crud=departamento_crud,
    prefix="/departamentos",
    tags=["departamentos"],
)
