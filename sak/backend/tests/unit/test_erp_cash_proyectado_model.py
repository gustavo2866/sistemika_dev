from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models.erp.cash_proyectado import ErpCashProyectado


def test_erp_cash_proyectado_preserva_campos() -> None:
    proyectado = ErpCashProyectado.model_validate(
        {
            "cuenta_cash_id": 12,
            "fecha_periodo": date(2026, 1, 1),
            "tipo": "PROYECCION",
            "importe": Decimal("125000.50"),
            "observacion": "Estimación mensual",
        }
    )

    assert proyectado.cuenta_cash_id == 12
    assert proyectado.fecha_periodo == date(2026, 1, 1)
    assert proyectado.tipo == "PROYECCION"
    assert proyectado.importe == Decimal("125000.50")
    assert proyectado.observacion == "Estimación mensual"


def test_erp_cash_proyectado_rechaza_fecha_que_no_inicia_el_mes() -> None:
    with pytest.raises(ValidationError, match="primer dia del mes"):
        ErpCashProyectado.model_validate(
            {
                "cuenta_cash_id": 12,
                "fecha_periodo": date(2026, 1, 15),
                "tipo": "PROYECCION",
                "importe": Decimal("100"),
            }
        )
