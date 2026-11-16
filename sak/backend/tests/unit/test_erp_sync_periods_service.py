from unittest.mock import MagicMock

import pytest

from app.services import erp_sync_periods_service as service


@pytest.mark.parametrize("available,expected_end", [
    ([(2026, 10), (2026, 11)], "2026-11"),
    ([(2026, 10), (2026, 11), (2027, 2)], "2027-02"),
    ([], "2026-10"),
])
def test_detects_sync_range_without_writing(available, expected_end, monkeypatch):
    connection = MagicMock()
    cursor = connection.__enter__.return_value.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = available
    monkeypatch.setattr(service.psycopg, "connect", lambda **_: connection)
    monkeypatch.setattr(service, "get_source_connection_kwargs", lambda: {})
    monkeypatch.setattr(service, "get_allowed_centros_costo", lambda _: ["10"])

    result = service.get_available_sync_periods(None, "202610")

    assert result == {"periodo_desde": "2026-10", "periodo_hasta": expected_end,
        "periodos": [f"{y:04d}-{m:02d}" for y, m in available]}
    cursor.execute.assert_called_once_with(service.SOURCE_PERIODS_QUERY, (2026, 10, ["10"], 2026, 10, ["10"]))


def test_invalid_start_does_not_connect(monkeypatch):
    connect = MagicMock()
    monkeypatch.setattr(service.psycopg, "connect", connect)
    with pytest.raises(ValueError):
        service.get_available_sync_periods(None, "2026-13")
    connect.assert_not_called()
