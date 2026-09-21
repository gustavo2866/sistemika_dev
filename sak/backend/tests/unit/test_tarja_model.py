from datetime import date
from decimal import Decimal

from app.models.tarja import Tarja


def test_tarja_model_exposes_premio_with_default_zero():
    tarja = Tarja(
        idproyecto=1,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )

    assert hasattr(Tarja, "premio")
    assert tarja.premio == Decimal("0")
    assert hasattr(Tarja, "viaticos")
    assert tarja.viaticos is False
    assert hasattr(Tarja, "viaticos")
    assert tarja.viaticos is False
