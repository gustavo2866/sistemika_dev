from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_sync import sync_cash_diario_periodo
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.cash_subcta import ErpCashSubcta
from app.routers.erp_cash_subcta_router import erp_cash_subcta_crud as crud
from tests.unit.test_erp_cash_diario_sync import _row


def test_subcta_clasificar_bloquear_y_desbloquear(db_session):
    item = crud.create(db_session, dict(tpo_subcta=1, nro_subcta=4566, descripcion="Subcuenta"))
    assert (item.estado, item.categoria) == ("error", None)
    item = crud.update_partial(db_session, item.id, {"categoria": " Obras "})
    assert (item.estado, item.categoria) == ("activa", "Obras")
    item = crud.update(db_session, item.id, {"estado": "bloqueada"})
    assert (item.estado, item.categoria) == ("bloqueada", "Obras")
    item = crud.update_partial(db_session, item.id, {"estado": "activa"})
    assert (item.estado, item.categoria) == ("activa", "Obras")


@pytest.mark.parametrize("payload", [
    {"estado": "invalido"}, {"categoria": "ERROR"},
])
def test_subcta_rechaza_estado_o_categoria_invalidos(db_session, payload):
    with pytest.raises(ValueError):
        crud.create(db_session, dict(tpo_subcta=1, nro_subcta=4566, descripcion="Subcuenta", **payload))
    assert db_session.exec(select(ErpCashSubcta)).all() == []


@pytest.mark.parametrize("estado", ["error", "bloqueada"])
def test_subcta_activar_sin_categoria(db_session, estado):
    item = crud.create(db_session, dict(tpo_subcta=1, nro_subcta=4566, descripcion="Subcuenta", estado=estado))
    item = crud.update_partial(db_session, item.id, {"estado": "activa"})
    db_session.refresh(item)
    assert (item.estado, item.categoria) == ("activa", None)
    item = crud.update_partial(db_session, item.id, {"estado": "activa", "categoria": "Obras"})
    assert (item.estado, item.categoria) == ("activa", "Obras")


@pytest.mark.parametrize("categoria", [None, "", "  "])
def test_subcta_crear_activa_y_quitar_categoria(db_session, categoria):
    item = crud.create(db_session, dict(tpo_subcta=1, nro_subcta=4566,
                                      descripcion="Subcuenta", estado="activa", categoria=categoria))
    assert (item.estado, item.categoria) == ("activa", None)
    item = crud.update(db_session, item.id, {"categoria": "Obras"})
    item = crud.update(db_session, item.id, {"categoria": categoria})
    assert (item.estado, item.categoria) == ("activa", None)


@pytest.mark.parametrize("deleted", [False, True])
def test_sync_incluye_bloqueadas_sin_cuenta_y_concilia_saldos_sin_reactivar(db_session, deleted):
    fondo = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    egreso = ErpCashCuenta(descripcion="Obras", tipo="Egreso")
    subcta = ErpCashSubcta(tpo_subcta=1, nro_subcta=4566, descripcion="Original", categoria="Obras")
    db_session.add_all([fondo, egreso, subcta])
    db_session.flush()
    db_session.add_all([
        ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fondo.id, map_haber_id=fondo.id),
        ErpCashMap(nro_cta=4100, moneda="ARS", categoria="Obras", map_debe_id=egreso.id, map_haber_id=egreso.id),
    ])
    db_session.commit()
    bank = _row(source_id=1, asiento="1", cuenta_codigo=1, haber="100")
    bank.tipo_subcuenta, bank.nro_subcuenta = "1", "4566"
    expense = _row(source_id=2, asiento="1", cuenta_codigo=4100, debe="100")
    expense.tipo_subcuenta, expense.nro_subcuenta = "01", "04566"
    saldo = dict(source_id=10, empresa_id=1, periodo_anio=2026, periodo_mes=8,
                 nivel="subcuenta", cuenta_codigo=1, tipo_subcuenta="1", nro_subcuenta="4566",
                 saldo_acumulado=Decimal("200"), fecha_periodo=date(2026, 8, 1),
                 total_debe=Decimal("0"), total_haber=Decimal("-100"),
                 saldo_periodo=Decimal("-100"), saldo_anterior=Decimal("300"))
    sync_cash_diario_periodo(db_session, "2026-08", source_data=([bank, expense], {}), saldo_source_rows=[saldo])
    previous = db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 2)).one()
    assert previous.cuenta_cash_id == egreso.id
    original_version = subcta.version
    subcta.estado = "bloqueada"
    if deleted:
        subcta.deleted_at = datetime.now(timezone.utc)
    db_session.add(subcta)
    db_session.commit()
    expense.debe = Decimal("999")
    new_expense = _row(source_id=3, asiento="1", cuenta_codigo=4100, debe="30")
    new_expense.tipo_subcuenta, new_expense.nro_subcuenta = "1", "4566"
    bank.haber = Decimal("-1029")
    saldo.update(total_haber=Decimal("-1029"), saldo_periodo=Decimal("-1029"),
                 saldo_acumulado=Decimal("-729"))
    for _ in range(2):
        result = sync_cash_diario_periodo(db_session, "2026-08", source_data=([bank, expense, new_expense], {}), saldo_source_rows=[saldo])
        db_session.refresh(subcta)
        previous = db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 2)).one()
        assert previous.debe == Decimal("999")
        assert previous.cuenta_cash_id is None
        assert subcta.estado == "bloqueada"
        assert subcta.categoria == "Obras"
        assert subcta.descripcion == "Original"
        assert subcta.version == original_version
        assert (subcta.deleted_at is not None) == deleted
        assert db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 3)).one().cuenta_cash_id is None
        rows = db_session.exec(select(ErpCashDiario)).all()
        assert len(rows) == 3
        assert all(row.cuenta_cash_id is None for row in rows)
        assert sum(row.debe + row.haber for row in rows) == 0
        stored_saldo = db_session.exec(select(ErpCashSaldo)).one()
        fund_movement = sum(row.debe + row.haber for row in rows if row.cuenta_codigo == 1)
        assert stored_saldo.saldo_anterior + fund_movement == stored_saldo.saldo_acumulado
        assert stored_saldo.saldo_periodo == fund_movement
        assert db_session.exec(select(ErpCashPeriodo)).one().movimientos_count == 3
        assert result["rows_inserted"] == 3

    subcta.deleted_at = None
    subcta.estado = "activa"
    db_session.add(subcta)
    db_session.commit()
    sync_cash_diario_periodo(db_session, "2026-08", source_data=([bank, expense, new_expense], {}), saldo_source_rows=[saldo])
    assert db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 2)).one().debe == Decimal("999")
    assert db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 3)).one().cuenta_cash_id == egreso.id


def test_sync_restaura_eliminada_sin_bloqueo_en_error(db_session):
    fondo = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    subcta = ErpCashSubcta(tpo_subcta=1, nro_subcta=4566, descripcion="Anterior", categoria="Obras", deleted_at=datetime.now(timezone.utc))
    db_session.add_all([fondo, subcta])
    db_session.flush()
    db_session.add(ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fondo.id, map_haber_id=fondo.id))
    db_session.commit()
    bank = _row(source_id=1, asiento="1", cuenta_codigo=1, debe="100")
    bank.tipo_subcuenta, bank.nro_subcuenta = "1", "4566"
    sync_cash_diario_periodo(db_session, "2026-08", source_data=([bank], {}), saldo_source_rows=[])
    db_session.refresh(subcta)
    assert subcta.deleted_at is None
    assert (subcta.estado, subcta.categoria) == ("error", None)
