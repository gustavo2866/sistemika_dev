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
