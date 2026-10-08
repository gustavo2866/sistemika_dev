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
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.cash_subcta import ErpCashSubcta
from app.models.erp.cash_saldo_sync import build_cash_saldo_payloads
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.rubro import ErpRubro


def _row(
    *,
    source_id: int,
    asiento: str,
    cuenta_codigo: int,
    empresa_id: int = 1,
    debe: str = "0",
    haber: str = "0",
):
    return SimpleNamespace(
        source_id=source_id,
        empresa_id=empresa_id,
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


def test_build_cash_diario_payloads_marca_asiento_por_mapeo_fondo_y_mapea_todas_las_lineas():
    ingreso = _row(source_id=1, asiento="1", cuenta_codigo=4100, haber="100")
    fondo = _row(source_id=2, asiento="1", cuenta_codigo=1, debe="100")
    egreso_sin_cash = _row(source_id=3, asiento="2", cuenta_codigo=5100, debe="50")
    disponibilidad_sin_fondo = _row(source_id=4, asiento="3", cuenta_codigo=2, debe="75")
    ingreso_empresa_excluida = _row(
        source_id=5,
        asiento="4",
        cuenta_codigo=4100,
        empresa_id=3,
        haber="80",
    )
    fondo_empresa_excluida = _row(
        source_id=6,
        asiento="4",
        cuenta_codigo=1,
        empresa_id=3,
        debe="80",
    )

    rubros = {
        4100: "03-INGRESOS",
        1: "99-OTROS",
        5100: "04-GASTOS",
        2: "01-DISPONIBILIDADES",
    }
    mappings = {
        (4100, ""): SimpleNamespace(map_debe_id=10, map_haber_id=11),
        (5100, ""): SimpleNamespace(map_debe_id=30, map_haber_id=31),
        (2, ""): SimpleNamespace(map_debe_id=40, map_haber_id=41),
    }
    fondo_mappings = {1: SimpleNamespace(map_debe_id=20, map_haber_id=20)}

    payloads = build_cash_diario_payloads(
        [
            ingreso,
            fondo,
            egreso_sin_cash,
            disponibilidad_sin_fondo,
            ingreso_empresa_excluida,
            fondo_empresa_excluida,
        ],
        rubros,
        mappings,
        fondo_mappings,
        {},
    )

    assert [row["cash"] for row in payloads] == ["SI", "SI"]
    assert payloads[0]["cuenta_cash_id"] == 11
    assert payloads[1]["cuenta_cash_id"] == 20


def test_build_cash_diario_payloads_prioriza_categoria_y_hace_fallback_general():
    specific = _row(source_id=10, asiento="10", cuenta_codigo=4100, haber="100")
    specific.tipo_subcuenta = "2"
    specific.nro_subcuenta = "15"
    fallback = _row(source_id=11, asiento="10", cuenta_codigo=4200, haber="50")
    fallback.tipo_subcuenta = "2"
    fallback.nro_subcuenta = "16"
    fondo = _row(source_id=12, asiento="10", cuenta_codigo=1, debe="150")

    payloads = build_cash_diario_payloads(
        [specific, fallback, fondo],
        {},
        {
            (4100, "obras"): SimpleNamespace(map_debe_id=100, map_haber_id=101),
            (4100, ""): SimpleNamespace(map_debe_id=110, map_haber_id=111),
            (4200, ""): SimpleNamespace(map_debe_id=120, map_haber_id=121),
        },
        {1: SimpleNamespace(map_debe_id=200, map_haber_id=200)},
        {(2, 15): " Obras ", (2, 16): "Administracion"},
    )

    assert [payload["cuenta_cash_id"] for payload in payloads] == [101, 121, 200]


def test_build_cash_saldo_payloads_solo_incluye_subcuentas_fondo():
    base = {
        "empresa_id": 1,
        "periodo_anio": 2026,
        "periodo_mes": 8,
        "tipo_subcuenta": "BAN",
        "nro_subcuenta": "001",
        "centro_costo": None,
        "total_debe": Decimal("100"),
        "total_haber": Decimal("25"),
        "saldo_periodo": Decimal("75"),
        "saldo_acumulado": Decimal("175"),
        "recalculado_en": datetime(2026, 8, 31, tzinfo=timezone.utc),
        "saldo_anterior": Decimal("100"),
        "fecha_periodo": date(2026, 8, 1),
    }
    rows = [
        {**base, "source_id": 1, "nivel": "subcuenta", "cuenta_codigo": 1},
        {**base, "source_id": 2, "nivel": "cuenta", "cuenta_codigo": 1},
        {**base, "source_id": 3, "nivel": "subcuenta", "cuenta_codigo": 2},
        {
            **base,
            "source_id": 4,
            "empresa_id": 3,
            "nivel": "subcuenta",
            "cuenta_codigo": 1,
        },
    ]

    payloads = build_cash_saldo_payloads(rows, {1})

    assert len(payloads) == 1
    assert payloads[0]["source_id"] == 1
    assert payloads[0]["nivel"] == "subcuenta"


def test_sync_cash_diario_periodo_reemplaza_el_periodo(db_session):
    rubro = ErpRubro(nombre="03-INGRESOS", activo=True)
    cuenta_cash_debe = ErpCashCuenta(descripcion="EGRESOS")
    cuenta_cash_haber = ErpCashCuenta(descripcion="INGRESOS")
    cuenta_cash_fondo = ErpCashCuenta(descripcion="FONDO BANCOS")
    db_session.add_all([rubro, cuenta_cash_debe, cuenta_cash_haber, cuenta_cash_fondo])
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
    fondo_mapping = ErpCashMap(
        nro_cta=1,
        moneda="ARS",
        map_debe_id=cuenta_cash_fondo.id,
        map_haber_id=cuenta_cash_fondo.id,
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
        tipo_subcuenta="2",
        nro_subcuenta="999",
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
    previous_saldo = ErpCashSaldo(
        source_id=998,
        empresa_id=1,
        periodo_anio=2026,
        periodo_mes=8,
        nivel="subcuenta",
        cuenta_codigo=9999,
    )
    source_saldo = {
        "source_id": 500,
        "empresa_id": 1,
        "periodo_anio": 2026,
        "periodo_mes": 8,
        "nivel": "subcuenta",
        "cuenta_codigo": 1,
        "tipo_subcuenta": "BAN",
        "nro_subcuenta": "001",
        "centro_costo": None,
        "total_debe": Decimal("125"),
        "total_haber": Decimal("0"),
        "saldo_periodo": Decimal("125"),
        "saldo_acumulado": Decimal("1125"),
        "recalculado_en": datetime(2026, 8, 31, tzinfo=timezone.utc),
        "saldo_anterior": Decimal("1000"),
        "fecha_periodo": date(2026, 8, 1),
    }
    db_session.add_all([cuenta, mapping, fondo_mapping, source, previous, previous_saldo])
    db_session.commit()
    db_session.expunge(previous)
    db_session.expunge(previous_saldo)

    result = sync_cash_diario_periodo(
        db_session,
        "2026-08",
        source_data=(
            [source, source_disponibilidad],
            {4100: "03-INGRESOS", 1: "01-DISPONIBILIDADES"},
        ),
        saldo_source_rows=[source_saldo],
    )
    generated = db_session.exec(select(ErpCashDiario)).all()
    generated_saldos = db_session.exec(select(ErpCashSaldo)).all()
    generated_subcuentas = db_session.exec(
        select(ErpCashSubcta).where(
            ErpCashSubcta.tpo_subcta == 2,
            ErpCashSubcta.nro_subcta == 999,
        )
    ).all()

    assert result == {
        "periodo": "2026-08",
        "rows_deleted": 1,
        "rows_inserted": 2,
        "saldos_deleted": 1,
        "saldos_inserted": 1,
        "cuentas_fondo": 1,
    }
    assert len(generated) == 2
    assert generated[0].source_id == 100
    assert generated[0].cuenta_cash_id == cuenta_cash_haber.id
    assert generated[1].source_id == 101
    assert generated[1].cuenta_cash_id == cuenta_cash_fondo.id
    assert len(generated_saldos) == 1
    assert generated_saldos[0].source_id == 500
    assert generated_saldos[0].nivel == "subcuenta"
    assert generated_saldos[0].cuenta_codigo == 1
    assert len(generated_subcuentas) == 1
    assert generated_subcuentas[0].categoria == "ERROR"
    assert generated_subcuentas[0].descripcion == "Cobro"
