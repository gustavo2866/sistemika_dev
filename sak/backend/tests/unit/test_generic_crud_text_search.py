from sqlalchemy.dialects import postgresql
from sqlmodel import select

from app.core.generic_crud import GenericCRUD
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput


def test_text_search_casts_numeric_searchable_fields_for_postgresql() -> None:
    crud = GenericCRUD(ErpCashMap)

    statement = crud._apply_text_search(select(ErpCashMap), "3874")
    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "CAST(erp_cash_map.nro_cta AS VARCHAR) ILIKE" in sql
    assert "erp_cash_map.moneda ILIKE" in sql
    assert "erp_cash_map.categoria ILIKE" in sql


def test_is_operator_accepts_null_literal_from_list_filters() -> None:
    crud = GenericCRUD(ErpCashPendientesInput)

    statement = crud._apply_filters(
        select(ErpCashPendientesInput),
        {"cuenta_cash_id__is": "null"},
    )
    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "erp_cash_pendientes_input.cuenta_cash_id IS NULL" in sql
