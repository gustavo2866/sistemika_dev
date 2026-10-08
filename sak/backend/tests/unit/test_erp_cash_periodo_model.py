from datetime import date

import pytest
from pydantic import ValidationError

from app.models.erp.cash_periodo import ErpCashPeriodo


def test_erp_cash_periodo_preserva_campos_y_normaliza_estado() -> None:
    periodo = ErpCashPeriodo.model_validate(
        {
            "fecha_periodo": date(2026, 8, 1),
            "estado": " cerrado ",
            "movimientos_count": 120,
            "saldos_count": 20,
        }
    )

    assert periodo.fecha_periodo == date(2026, 8, 1)
    assert periodo.estado == "CERRADO"
    assert periodo.movimientos_count == 120
    assert periodo.saldos_count == 20


def test_erp_cash_periodo_rechaza_fecha_que_no_inicia_el_mes() -> None:
    with pytest.raises(ValidationError, match="primer dia del mes"):
        ErpCashPeriodo.model_validate(
            {
                "fecha_periodo": date(2026, 8, 15),
                "estado": "ABIERTO",
            }
        )


def test_erp_cash_periodo_rechaza_estado_desconocido() -> None:
    with pytest.raises(ValidationError, match="ABIERTO o CERRADO"):
        ErpCashPeriodo.model_validate(
            {
                "fecha_periodo": date(2026, 8, 1),
                "estado": "EN_PROCESO",
            }
        )
