from app.models.erp.libro_diario_sync import get_source_connection_kwargs


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
