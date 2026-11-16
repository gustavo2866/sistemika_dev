from app.models.base import filtrar_respuesta
from app.models.erp.cash_map import ErpCashMap
from app.routers.erp_cash_map_router import ErpCashMapCRUD


def test_cash_map_includes_ledger_account_name(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routers.erp_cash_map_router.get_ledger_accounts",
        lambda _session, _codes: {3874: ("4.1.01", "Cuenta corriente")},
    )
    item = ErpCashMap(
        id=1,
        nro_cta=3874,
        moneda="ARS",
        map_debe_id=1,
        map_haber_id=2,
    )
    crud = ErpCashMapCRUD(ErpCashMap)

    crud._populate_calculated(None, [item])

    assert filtrar_respuesta(item)["cuenta_nombre"] == "Cuenta corriente"


def test_account_mappings_include_both_sides_once_and_paginate(db_session, monkeypatch):
    from datetime import datetime, timezone

    monkeypatch.setattr("app.routers.erp_cash_map_router.get_ledger_accounts", lambda *_: {})
    for code, debit, credit, category, deleted in [
        (1, 7, 8, "Obras", False),
        (2, 8, 7, "Obras", False),
        (3, 7, 7, "Obras", False),
        (4, 8, 9, "Obras", False),
        (5, 7, 8, "Administración", False),
        (6, 7, 8, "Obras", True),
    ]:
        db_session.add(ErpCashMap(
            nro_cta=code, moneda="ARS", categoria=category,
            map_debe_id=debit, map_haber_id=credit,
            deleted_at=datetime.now(timezone.utc) if deleted else None,
        ))
    db_session.commit()
    crud = ErpCashMapCRUD(ErpCashMap)
    filters = {"cuenta_cash_id": "7", "categoria": "Obras"}

    first, total = crud.list(db_session, filters=filters, sort_by="nro_cta", per_page=2)
    second, second_total = crud.list(db_session, filters=filters, sort_by="nro_cta", per_page=2, page=2)

    assert [item.nro_cta for item in first] == [1, 2]
    assert [item.nro_cta for item in second] == [3]
    assert total == second_total == 3
    assert filters == {"cuenta_cash_id": "7", "categoria": "Obras"}

    all_items, total = crud.list(db_session, filters={"cuenta_cash_id": 7}, sort_by="nro_cta")
    assert [item.nro_cta for item in all_items] == [1, 2, 3, 5]
    assert total == 4


def test_categorias_sin_duplicados_blancos_ni_mapeos_eliminados(db_session):
    from datetime import datetime, timezone
    from fastapi import Response
    from app.routers.erp_cash_map_router import list_cash_map_categories

    for index, category in enumerate(["Fondo", "Obras", "Fondo", "  Obras  ", "", "  ", None, "Eliminada"]):
        db_session.add(ErpCashMap(
            nro_cta=index + 1, moneda="ARS", categoria=category,
            map_debe_id=1, map_haber_id=2,
            deleted_at=datetime.now(timezone.utc) if category == "Eliminada" else None,
        ))
    db_session.commit()
    response = Response()
    assert list_cash_map_categories(response, db_session) == [
        {"id": "Fondo", "name": "Fondo"}, {"id": "Obras", "name": "Obras"},
    ]
    assert response.headers["Content-Range"] == "items 0-1/2"
