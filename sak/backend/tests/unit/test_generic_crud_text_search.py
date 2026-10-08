from sqlalchemy.dialects import postgresql
from sqlmodel import select

from app.core.generic_crud import GenericCRUD
from app.models.erp.cash_map import ErpCashMap


def test_text_search_casts_numeric_searchable_fields_for_postgresql() -> None:
    crud = GenericCRUD(ErpCashMap)

    statement = crud._apply_text_search(select(ErpCashMap), "3874")
    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "CAST(erp_cash_map.nro_cta AS VARCHAR) ILIKE" in sql
    assert "erp_cash_map.moneda ILIKE" in sql
    assert "erp_cash_map.categoria ILIKE" in sql
