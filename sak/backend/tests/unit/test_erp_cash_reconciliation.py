from datetime import date

import pytest

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.libro_diario import ErpLibroDiario
from app.services.erp_cash_reconciliation_service import reconcile_cash


def _data(session):
    fund = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    session.add(fund)
    session.flush()
    session.add(ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fund.id, map_haber_id=fund.id))
    rows = [ErpCashDiario(source_id=i, empresa_id=1, fecha=date(2026, 1, 2),
        periodo_anio=2026, periodo_mes=1, tipo_asiento="A", nro_asiento="1",
        cuenta_codigo=account, debe=debit, haber=credit, cuenta_cash_id=None)
        for i, account, debit, credit in [(1, 1, 20, 0), (2, 4100, 0, -20)]]
    previous = ErpCashSaldo(source_id=1, empresa_id=1, periodo_anio=2025, periodo_mes=12,
        nivel="subcuenta", cuenta_codigo=1, saldo_acumulado=100)
    current = ErpCashSaldo(source_id=2, empresa_id=1, periodo_anio=2026, periodo_mes=1,
        nivel="subcuenta", cuenta_codigo=1, saldo_anterior=100, saldo_periodo=20,
        saldo_acumulado=120, total_debe=20, total_haber=0)
    session.add_all([previous, current, *rows])
    session.commit()
    return rows, previous, current


def test_concilia_asientos_sin_cuenta_y_saldos_continuos(db_session):
    _data(db_session)
    result = reconcile_cash(db_session, {date(2026, 1, 1)})
    assert result == {"consistente": True, "controles": 5, "diferencias": 0, "detalle": []}


@pytest.mark.parametrize("problem,expected", [
    ("renglon_omitido", "asiento_balanceado"),
    ("diario_distinto", "movimiento_diario"),
    ("saldo_actual_distinto", "saldo_anterior_mas_movimiento"),
    ("mayor_distinto", "movimiento_mayor"),
    ("anterior_distinto", "continuidad_saldos"),
])
def test_detecta_diferencias_sin_modificar_datos(db_session, problem, expected):
    rows, previous, current = _data(db_session)
    if problem == "renglon_omitido":
        db_session.delete(rows[1])
    elif problem == "diario_distinto":
        rows[0].debe = 10
    elif problem == "saldo_actual_distinto":
        current.saldo_acumulado = 130
    elif problem == "mayor_distinto":
        current.total_debe = 30
    else:
        previous.saldo_acumulado = 90
    db_session.commit()
    result = reconcile_cash(db_session, {date(2026, 1, 1)})
    assert result["consistente"] is False
    assert expected in {item["control"] for item in result["detalle"]}
    assert not db_session.dirty and not db_session.new and not db_session.deleted


def test_no_compensa_diferencias_entre_empresas(db_session):
    rows, _, _ = _data(db_session)
    rows[1].empresa_id = 2
    db_session.commit()
    result = reconcile_cash(db_session, {date(2026, 1, 1)})
    differences = [item for item in result["detalle"] if item["control"] == "asiento_balanceado"]
    assert len(differences) == 2
    assert {item["empresa_id"] for item in differences} == {1, 2}


def test_detecta_asiento_entero_faltante_aunque_el_diario_balancee(db_session):
    _data(db_session)
    for source_id, account, debit, credit in [(10, 1, 50, 0), (11, 4100, 0, -50)]:
        db_session.add(ErpLibroDiario(source_id=source_id, empresa_id=1,
            fecha=date(2026, 1, 3), periodo_anio=2026, periodo_mes=1,
            tipo_asiento="A", nro_asiento="2", cuenta_codigo=account,
            debe=debit, haber=credit, es_obra=False))
    db_session.commit()
    result = reconcile_cash(db_session, {date(2026, 1, 1)})
    difference = next(d for d in result["detalle"] if d["control"] == "renglones_origen_faltantes")
    assert difference["source_ids"] == [10, 11]
    assert result["consistente"] is False
