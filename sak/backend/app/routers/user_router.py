from app.models.user import User
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico para User
user_crud = GenericCRUD(User)

# Crear router genérico
user_router = create_generic_router(
    model=User,
    crud=user_crud,
    prefix="/users",
    tags=["users"]
)
