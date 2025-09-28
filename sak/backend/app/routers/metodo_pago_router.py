from app.models.metodo_pago import MetodoPago
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

metodo_pago_crud = GenericCRUD(MetodoPago)

metodo_pago_router = create_generic_router(
    model=MetodoPago,
    crud=metodo_pago_crud,
    prefix="/metodos-pago",
    tags=["metodos-pago"],
)
