from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.proy_presupuesto import ProyPresupuesto

proy_presupuesto_crud = GenericCRUD(ProyPresupuesto)

proy_presupuesto_router = create_generic_router(
    model=ProyPresupuesto,
    crud=proy_presupuesto_crud,
    prefix="/proy-presupuestos",
    tags=["proy-presupuestos"],
)