from datetime import date
from unittest.mock import MagicMock

import pytest
from scripts import generate_erp_cash_proyectado as script


@pytest.mark.parametrize("mode,committed", [("--dry-run", False), ("--apply", True)])
def test_generador_usa_motor_compartido_y_confirma_solo_al_aplicar(monkeypatch, mode, committed):
    session = MagicMock()
    session.__enter__.return_value = session
    monkeypatch.setattr(script, "Session", lambda _: session)
    pending = MagicMock()
    calculate = MagicMock(return_value={"proyecciones_calculadas": 1})
    monkeypatch.setattr(script, "rebuild_pending_cash_projection", pending)
    monkeypatch.setattr(script, "recalculate_cash_projections", calculate)
    monkeypatch.setattr("sys.argv", ["generate", "--start", "2026-03", "--months", "1", mode])
    script.main()
    calculate.assert_called_once_with(session, date(2026, 3, 1), date(2026, 3, 1))
    assert session.commit.called is committed
    assert session.rollback.called is not committed


def test_generador_revierte_si_falla_una_dependencia(monkeypatch):
    session = MagicMock()
    session.__enter__.return_value = session
    monkeypatch.setattr(script, "Session", lambda _: session)
    monkeypatch.setattr(script, "rebuild_pending_cash_projection", MagicMock())
    monkeypatch.setattr(script, "recalculate_cash_projections", MagicMock(side_effect=ValueError("Dependencia circular")))
    monkeypatch.setattr("sys.argv", ["generate", "--apply"])
    with pytest.raises(ValueError, match="circular"):
        script.main()
    session.rollback.assert_called_once()
    session.commit.assert_not_called()
