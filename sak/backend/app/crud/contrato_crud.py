from app.core.nested_crud import NestedCRUD
from app.models.contrato import Contrato
from app.models.contrato_archivo import ContratoArchivo

contrato_crud = NestedCRUD(
    Contrato,
    nested_relations={
        "archivos": {
            "model": ContratoArchivo,
            "fk_field": "contrato_id",
            "allow_delete": True,
        }
    },
)
