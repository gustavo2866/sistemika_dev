from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_sync import (
    build_cash_diario_payloads,
    sync_cash_diario_periodo,
)
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.rubro import ErpRubro


def _row(
    *,
    source_id: int,
    asiento: str,
    cuenta_codigo: int,
    debe: str = "0",
    haber: str = "0",
):
    return SimpleNamespace(
        source_id=source_id,
        empresa_id=1,
        fecha=date(2026, 8, 1),
        periodo_anio=2026,
        periodo_mes=8,
        tipo_asiento="A",
        nro_asiento=asiento,
        nro_renglon=str(source_id),
        cuenta_codigo=cuenta_codigo,
        debe=Decimal(debe),
        haber=Decimal(haber),
        descripcion="Movimiento",
        tipo_subcuenta=None,
        nro_subcuenta=None,
        centro_costo=None,
        cargado_en=datetime(2026, 8, 1, tzinfo=timezone.utc),
        archivo_origen="origen.csv",
    )


def test_build_cash_diario_payloads_marca_asiento_y_mapea_por_debe_haber():
    ingreso = _row(source_id=1, asiento="1", cuenta_codigo=4100, haber="100")
    disponibilidad = _row(source_id=2, asiento="1", cuenta_codigo=1, debe="100")
    egreso_sin_cash = _row(source_id=3, asiento="2", cuenta_codigo=5100, debe="50")

    rubros = {
        4100: "03-INGRESOS",
        1: "01 - DISPONIBILIDADES",
        5100: "04-GASTOS",
    }
    mappings = {
        4100: SimpleNamespace(map_debe_id=10, map_haber_id=11),
        1: SimpleNamespace(map_debe_id=20, map_haber_id=21),
        5100: SimpleNamespace(map_debe_id=30, map_haber_id=31),
    }

    payloads = build_cash_diario_payloads(
        [ingreso, disponibilidad, egreso_sin_cash],
        rubros,
        mappings,
    )

    assert [row["cash"] for row in payloads] == ["SI", "SI"]
    assert payloads[0]["cuenta_cash_id"] == 11
    assert payloads[1]["cuenta_cash_id"] is None


def test_sync_cash_diario_periodo_reemplaza_el_periodo(db_session):
    rubro = ErpRubro(nombre="03-INGRESOS", activo=True)
    cuenta_cash_debe = ErpCashCuenta(descripcion="EGRESOS")
    cuenta_cash_haber = ErpCashCuenta(descripcion="INGRESOS")
    db_session.add_all([rubro, cuenta_cash_debe, cuenta_cash_haber])
    db_session.flush()

    cuenta = ErpCuenta(
        rubro_id=rubro.id,
        nro_cuenta=4100,
        cod_cuenta="4.1.0.0",
        descripcion="Ingresos",
        activo=True,
    )
    mapping = ErpCashMap(
        nro_cta=4100,
        moneda="ARS",
        map_debe_id=cuenta_cash_debe.id,
        map_haber_id=cuenta_cash_haber.id,
    )
    source = ErpLibroDiario(
        source_id=100,
        empresa_id=1,
        fecha=date(2026, 8, 15),
        periodo_anio=2026,
        periodo_mes=8,
        cuenta_codigo=4100,
        debe=Decimal("0"),
        haber=Decimal("125"),
        descripcion="Cobro",
    )
    source_disponibilidad = ErpLibroDiario(
        source_id=101,
        empresa_id=1,
        fecha=date(2026, 8, 15),
        periodo_anio=2026,
        periodo_mes=8,
        tipo_asiento=source.tipo_asiento,
        nro_asiento=source.nro_asiento,
        cuenta_codigo=1,
        debe=Decimal("125"),
        haber=Decimal("0"),
        descripcion="Banco",
    )
    previous = ErpCashDiario(
        source_id=999,
        empresa_id=1,
        fecha=date(2026, 8, 1),
        periodo_anio=2026,
        periodo_mes=8,
        cuenta_codigo=9999,
        debe=Decimal("0"),
        haber=Decimal("0"),
    )
    db_session.add_all([cuenta, mapping, source, previous])
    db_session.commit()
    db_session.expunge(previous)

    result = sync_cash_diario_periodo(
        db_session,
        "2026-08",
        source_data=(
            [source, source_disponibilidad],
            {4100: "03-INGRESOS", 1: "01-DISPONIBILIDADES"},
        ),
    )
    generated = db_session.exec(select(ErpCashDiario)).all()

    assert result == {
        "periodo": "2026-08",
        "rows_deleted": 1,
        "rows_inserted": 2,
    }
    assert len(generated) == 2
    assert generated[0].source_id == 100
    assert generated[0].cuenta_cash_id == cuenta_cash_haber.id
    assert generated[1].source_id == 101
    assert generated[1].cuenta_cash_id is None
