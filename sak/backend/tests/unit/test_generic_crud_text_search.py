from sqlalchemy.dialects import postgresql
from sqlmodel import select

from app.core.generic_crud import GenericCRUD
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.cash_subcta import ErpCashSubcta


def test_cash_subcta_search_finds_number_without_matching_description() -> None:
    from sqlmodel import Session, create_engine

    engine = create_engine("sqlite://")
    ErpCashSubcta.__table__.create(engine)
    try:
        with Session(engine) as session:
            session.add_all([
                ErpCashSubcta(tpo_subcta=1, nro_subcta=4566, descripcion="Alquiler", estado="error"),
                ErpCashSubcta(tpo_subcta=1, nro_subcta=7890, descripcion="Proveedor", categoria="Obras"),
            ])
            session.commit()
            crud = GenericCRUD(ErpCashSubcta)

            for query, expected_number in [("4566", 4566), ("alquiler", 4566), ("obras", 7890)]:
                statement = crud._apply_text_search(select(ErpCashSubcta), query)
                assert [row.nro_subcta for row in session.exec(statement).all()] == [expected_number]

            sql = str(crud._apply_text_search(select(ErpCashSubcta), "4566").compile(dialect=postgresql.dialect()))
            assert "CAST(erp_cash_subctas.nro_subcta AS VARCHAR) ILIKE" in sql
    finally:
        engine.dispose()


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
