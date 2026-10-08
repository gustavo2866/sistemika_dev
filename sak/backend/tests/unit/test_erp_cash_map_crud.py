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
