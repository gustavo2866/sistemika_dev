from app.core.nested_crud import NestedCRUD
from app.models.taxes import TaxProfile, TaxProfileDetail

tax_profile_crud = NestedCRUD(
    TaxProfile,
    nested_relations={
        "details": {
            "model": TaxProfileDetail,
            "fk_field": "profile_id",
            "allow_delete": True,
        }
    },
)