from importlib import import_module

from app.models.erp.libro_diario_sync import get_source_connection_kwargs
from app.routers.erp_libro_diario_router import _iter_periods


diario_router_module = import_module("app.routers.erp_libro_diario_router")


def test_get_source_connection_kwargs_uses_conninfo_for_url(monkeypatch):
    for name in (
        "ERP_SOURCE_DB_HOST",
        "ERP_SOURCE_DB_NAME",
        "ERP_SOURCE_DB_USER",
        "NEON_DB_PASSWORD",
        "ERP_SOURCE_DB_PASSWORD",
        "EXTERNAL_NEON_DATABASE_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(
        "ERP_SOURCE_DATABASE_URL",
        "postgresql+psycopg://user:password@example.com/database?sslmode=require",
    )

    assert get_source_connection_kwargs() == {
        "conninfo": "postgresql://user:password@example.com/database?sslmode=require"
    }


def test_iter_periods_includes_complete_range():
    assert list(_iter_periods("2025-11", "2026-02")) == [
        "202511",
        "202512",
        "202601",
        "202602",
    ]


def test_sync_range_can_defer_presupuesto_update(monkeypatch):
    calls = []

    def fake_run_sync(periodo, batch_size, dry_run, *, sync_presupuestos=True):
        calls.append((periodo, batch_size, dry_run, sync_presupuestos))
        return {"periodo": periodo}

    monkeypatch.setattr(diario_router_module, "run_sync", fake_run_sync)

    result = diario_router_module.sync_erp_libro_diario_range(
        {
            "periodo_desde": "2026-01",
            "periodo_hasta": "2026-02",
            "actualizar_presupuestos": False,
        }
    )

    assert calls == [
        ("202601", 5000, False, False),
        ("202602", 5000, False, False),
    ]
    assert result["actualizar_presupuestos"] is False


def test_sync_diario_cerrado_no_abre_origen_ni_reemplaza_datos(monkeypatch):
    from unittest.mock import MagicMock
    import pytest
    from app.models.erp import libro_diario_sync as sync

    dest = MagicMock()
    dest.__enter__.return_value = dest
    dest.cursor.return_value.__enter__.return_value.fetchone.return_value = ("CERRADO",)
    calls = []
    def connect(*args, **kwargs):
        calls.append((args, kwargs))
        assert len(calls) == 1, "No debe conectar al ERP para un mes cerrado"
        return dest
    monkeypatch.setattr(sync, "get_dest_url", lambda: "destino")
    monkeypatch.setattr(sync, "get_source_connection_kwargs", lambda: {})
    monkeypatch.setattr(sync.psycopg, "connect", connect)
    with pytest.raises(ValueError, match="debe reabrirse"):
        sync.run_sync("2026-08", 5000, False)
    cursor = dest.cursor.return_value.__enter__.return_value
    assert len(cursor.execute.call_args_list) == 1
    assert "FOR UPDATE" in cursor.execute.call_args.args[0]
    dest.commit.assert_not_called()
    with pytest.raises(ValueError, match="debe reabrirse"):
        sync.sync_real_presupuestos(dest, 2026, 8, False)
