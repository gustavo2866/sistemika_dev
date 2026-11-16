from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models.erp.indice import ErpIndice
from app.routers.erp_indice_router import erp_indice_router


def test_erp_indice_model_metadata() -> None:
    assert ErpIndice.__tablename__ == "erp_indice"
    assert ErpIndice.__table__.c.valor.type.precision == 18
    assert ErpIndice.__table__.c.valor.type.scale == 6
    assert set(ErpIndice.__searchable_fields__) == {"codigo"}


def test_erp_indice_normaliza_y_valida_codigo() -> None:
    indice = ErpIndice.model_validate(
        {"codigo": " ipc ", "fecha": date(2026, 10, 1), "valor": Decimal("2.1")}
    )
    assert indice.codigo == "IPC"

    with pytest.raises(ValidationError):
        ErpIndice.model_validate(
            {"codigo": "OTRO", "fecha": date(2026, 10, 1), "valor": Decimal("2.1")}
        )


def test_erp_indice_router_expone_crud() -> None:
    collection_methods = set().union(*(
        route.methods or set()
        for route in erp_indice_router.routes
        if route.path == "/erp/indices"
    ))
    item_methods = set().union(*(
        route.methods or set()
        for route in erp_indice_router.routes
        if route.path == "/erp/indices/{obj_id:int}"
    ))
    assert collection_methods >= {"GET", "POST"}
    assert item_methods >= {
        "GET",
        "PUT",
        "PATCH",
        "DELETE",
    }
