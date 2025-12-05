from app.core.router import create_generic_router
from app.models import Setting
from app.crud.setting_crud import setting_crud


setting_router = create_generic_router(
    model=Setting,
    crud=setting_crud,
    prefix="/settings",
    tags=["settings"],
)
