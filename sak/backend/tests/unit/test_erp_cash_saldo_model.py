from datetime import UTC, date, datetime
from decimal import Decimal

from app.models.erp.cash_saldo import ErpCashSaldo


def test_erp_cash_saldo_preserva_campos_de_libro_mayor() -> None:
    saldo = ErpCashSaldo(
        source_id=321,
        empresa_id=2,
        periodo_anio=2024,
        periodo_mes=12,
        nivel="cuenta",
        cuenta_codigo=1736,
        tipo_subcuenta="CLI",
        nro_subcuenta="0001",
        centro_costo="101",
        total_debe=Decimal("150.25"),
        total_haber=Decimal("75.10"),
        saldo_periodo=Decimal("75.15"),
        saldo_acumulado=Decimal("200.15"),
        recalculado_en=datetime(2024, 12, 31, 23, 0, tzinfo=UTC),
        saldo_anterior=Decimal("125.00"),
        fecha_periodo=date(2024, 12, 1),
    )

    assert saldo.source_id == 321
    assert saldo.nivel == "cuenta"
    assert saldo.cuenta_codigo == 1736
    assert saldo.total_debe == Decimal("150.25")
    assert saldo.total_haber == Decimal("75.10")
    assert saldo.saldo_periodo == Decimal("75.15")
    assert saldo.saldo_acumulado == Decimal("200.15")
    assert saldo.saldo_anterior == Decimal("125.00")
    assert saldo.fecha_periodo == date(2024, 12, 1)