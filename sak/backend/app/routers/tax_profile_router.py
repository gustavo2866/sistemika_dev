from app.core.router import create_generic_router
from app.models.taxes import TaxProfile
from app.crud.tax_profile_crud import tax_profile_crud

tax_profile_router = create_generic_router(
    model=TaxProfile,
    crud=tax_profile_crud,
    prefix="/api/v1/tax-profiles",
    tags=["tax-profiles"],
)