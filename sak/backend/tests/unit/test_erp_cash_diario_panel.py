from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_panel import (
    apply_projected_balance_totals,
    build_cash_panel,
    build_cash_balance_totals,
    build_month_ranges,
    get_cash_panel,
    get_cash_panel_detail,
)
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado


def test_panel_usa_total_generado_y_lo_arrastra_al_saldo_inicial(db_session):
    account = ErpCashCuenta(descripcion="Total por método", tipo="Ingreso")
    db_session.add(account)
    db_session.flush()
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, 9, 1), estado="CERRADO"))
    for month, base, projected, pending, committed in (
        (10, "PENDIENTE", "999", "100", "20"),
        (11, "HISTORICO", "200", "999", "30"),
    ):
        db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, month, 1), estado="ABIERTO"))
        db_session.add(ErpCashProyectado(
            cuenta_cash_id=account.id, fecha_periodo=date(2026, month, 1), tipo_calculo=base,
            importe_proyectado=Decimal(projected), importe_pendiente=Decimal(pending),
            importe_comprometido=Decimal(committed),
        ))
    db_session.commit()
    panel = get_cash_panel(db_session, "2026-10")
    income = next(group for group in panel["groups"] if group["key"] == "INGRESOS")
    assert income["projected_months"]["2026-10"] == 120
    assert income["projected_months"]["2026-11"] == 230
    assert income["projected_total"] == 350
    assert panel["balances"]["saldo_final"]["2026-11"] == 350
    shifted = get_cash_panel(db_session, "2026-11")
    assert shifted["balances"]["saldo_anterior"]["2026-11"] == 120
    assert shifted["balances"]["saldo_final"]["2026-11"] == 350


def _row(
    *,
    row_id: int,
    fecha: date,
    rubro: str,
    debe: str = "0",
    haber: str = "0",
    cuenta_cash_id: int | None = 1,
    cuenta_codigo: int = 4100,
):
    return SimpleNamespace(
        id=row_id,
        empresa_id=1,
        fecha=fecha,
        tipo_asiento="A",
        nro_asiento="10",
        cuenta_codigo=cuenta_codigo,
        tipo_subcuenta="2",
        nro_subcuenta="15",
        debe=Decimal(debe),
        haber=Decimal(haber),
        descripcion="Movimiento",
        rubro=rubro,
        cuenta_cash_id=cuenta_cash_id,
    )


def test_cash_panel_agrupa_por_tipo_en_12_meses_y_muestra_fondo_al_final():
    rows = [
        (_row(row_id=1, fecha=date(2026, 8, 3), rubro="03-INGRESOS", haber="-100"), "Cobros", "Ingreso", "4.1.0.0", "Ventas"),
        (_row(row_id=2, fecha=date(2026, 9, 10), rubro="04-GASTOS", debe="40", cuenta_cash_id=2, cuenta_codigo=5100), "Pagos", "Egreso", "5.1.0.0", "Proveedores"),
        (_row(row_id=6, fecha=date(2026, 11, 10), rubro="04-OTROS CREDITOS", debe="15", cuenta_cash_id=3, cuenta_codigo=5300), "Fondo", "Fondo", "5.3.0.0", "Fondos"),
        (_row(row_id=3, fecha=date(2026, 10, 10), rubro="01 - DISPONIBILIDADES", debe="60"), "Cobros", "Ingreso", "1.1.0.0", "Bancos"),
        (_row(row_id=4, fecha=date(2027, 7, 31), rubro="04-GASTOS", haber="-10", cuenta_cash_id=2, cuenta_codigo=5200), "Pagos", "Egreso", "5.2.0.0", "Impuestos"),
        (_row(row_id=5, fecha=date(2027, 1, 20), rubro="03-INGRESOS", haber="-25", cuenta_cash_id=None), None, None, "4.1.0.0", "Ventas"),
    ]

    panel = build_cash_panel(rows, anio=2026, mes=8)

    assert len(panel["months"]) == 12
    assert panel["months"][0]["key"] == "2026-08"
    assert panel["months"][-1]["key"] == "2027-07"
    assert [group["label"] for group in panel["groups"]] == ["INGRESOS", "EGRESOS", "SIN CUENTA", "FONDO"]

    ingresos, egresos, sin_cuenta, fondos = panel["groups"]
    assert ingresos["total"] == 40.0
    assert ingresos["accounts"][0]["months"]["2026-08"] == 100.0
    assert ingresos["accounts"][0]["months"]["2026-10"] == -60.0
    assert ingresos["accounts"][0]["movement_count"] == 2
    assert egresos["total"] == -30.0
    assert egresos["accounts"][0]["months"]["2026-09"] == -40.0
    assert egresos["accounts"][0]["months"]["2027-07"] == 10.0
    assert egresos["accounts"][0]["movement_count"] == 2
    assert [account["cuenta_codigo"] for account in egresos["accounts"][0]["ledger_accounts"]] == [5100, 5200]
    assert egresos["accounts"][0]["ledger_accounts"][0]["months"]["2026-09"] == -40.0
    assert egresos["accounts"][0]["ledger_accounts"][1]["months"]["2027-07"] == 10.0
    assert sin_cuenta["total"] == 25.0
    assert sin_cuenta["accounts"][0]["cuenta_cash_nombre"] == "Sin cuenta Cash"
    assert fondos["total"] == -15.0
    assert fondos["accounts"][0]["months"]["2026-11"] == -15.0
    assert fondos["accounts"][0]["movement_count"] == 1
    assert panel["total"] == 20.0


def test_month_ranges_genera_12_columnas_y_cruza_el_anio():
    months = build_month_ranges(2028, 2)

    assert [month["key"] for month in months[:2]] == ["2028-02", "2028-03"]
    assert months[-1] == {
        "key": "2029-01",
        "label": "01/2029",
        "start": "2029-01-01",
        "end": "2029-01-31",
    }


def test_cash_panel_incorpora_proyectado_por_grupo_y_cuenta():
    rows = [
        (
            _row(row_id=1, fecha=date(2026, 1, 3), rubro="03-INGRESOS", haber="-100"),
            "Cobros",
            "Ingreso",
            "4.1.0.0",
            "Ventas",
        ),
    ]
    projected_rows = [
        SimpleNamespace(
            cuenta_cash_id=1,
            fecha_periodo=date(2026, 1, 1),
            cuenta_cash_nombre="Cobros",
            cuenta_cash_tipo="Ingreso",
            importe=Decimal("125"),
        ),
        SimpleNamespace(
            cuenta_cash_id=2,
            fecha_periodo=date(2026, 1, 1),
            cuenta_cash_nombre="Pagos",
            cuenta_cash_tipo="Egreso",
            importe=Decimal("-80"),
        ),
    ]

    panel = build_cash_panel(
        rows,
        anio=2026,
        mes=1,
        projected_rows=projected_rows,
    )

    ingresos, egresos = panel["groups"][:2]
    assert ingresos["projected_months"]["2026-01"] == 125.0
    assert ingresos["projected_total"] == 125.0
    assert ingresos["accounts"][0]["projected_months"]["2026-01"] == 125.0
    assert egresos["months"]["2026-01"] == 0.0
    assert egresos["projected_months"]["2026-01"] == -80.0
    assert egresos["accounts"][0]["projected_total"] == -80.0


def test_saldos_proyectados_se_calculan_solo_para_periodos_abiertos():
    panel = build_cash_panel(
        [],
        anio=2026,
        mes=1,
        projected_rows=[
            SimpleNamespace(
                cuenta_cash_id=1,
                fecha_periodo=date(2026, 2, 1),
                cuenta_cash_nombre="Cobros",
                cuenta_cash_tipo="Ingreso",
                importe=Decimal("50"),
            ),
            SimpleNamespace(
                cuenta_cash_id=2,
                fecha_periodo=date(2026, 2, 1),
                cuenta_cash_nombre="Pagos",
                cuenta_cash_tipo="Egreso",
                importe=Decimal("-10"),
            ),
            SimpleNamespace(
                cuenta_cash_id=1,
                fecha_periodo=date(2026, 3, 1),
                cuenta_cash_nombre="Cobros",
                cuenta_cash_tipo="Ingreso",
                importe=Decimal("30"),
            ),
            SimpleNamespace(
                cuenta_cash_id=2,
                fecha_periodo=date(2026, 3, 1),
                cuenta_cash_nombre="Pagos",
                cuenta_cash_tipo="Egreso",
                importe=Decimal("-5"),
            ),
        ],
    )
    balances = build_cash_balance_totals([], panel["months"])
    balances["saldo_anterior"]["2026-01"] = 100.0
    balances["saldo_periodo"]["2026-01"] = 20.0
    balances["saldo_final"]["2026-01"] = 120.0

    result = apply_projected_balance_totals(
        panel,
        balances,
        {
            "2026-01": "CERRADO",
            "2026-02": "ABIERTO",
            "2026-03": "ABIERTO",
        },
    )

    assert result["saldo_anterior"]["2026-02"] == 120.0
    assert result["saldo_periodo"]["2026-02"] == 40.0
    assert result["saldo_final"]["2026-02"] == 160.0
    assert result["saldo_anterior"]["2026-03"] == 160.0
    assert result["saldo_periodo"]["2026-03"] == 25.0
    assert result["saldo_final"]["2026-03"] == 185.0
    assert result["projected_months"] == ["2026-02", "2026-03"]


def test_cash_balance_totals_acumula_saldos_subcuenta_por_mes():
    months = build_month_ranges(2026, 1)
    rows = [
        ErpCashSaldo(
            source_id=1,
            empresa_id=1,
            periodo_anio=2026,
            periodo_mes=1,
            nivel="subcuenta",
            cuenta_codigo=100,
            saldo_anterior=Decimal("100"),
            saldo_periodo=Decimal("25"),
            saldo_acumulado=Decimal("125"),
        ),
        ErpCashSaldo(
            source_id=2,
            empresa_id=2,
            periodo_anio=2026,
            periodo_mes=1,
            nivel="subcuenta",
            cuenta_codigo=100,
            saldo_anterior=Decimal("50"),
            saldo_periodo=Decimal("-10"),
            saldo_acumulado=Decimal("40"),
        ),
        ErpCashSaldo(
            source_id=3,
            empresa_id=1,
            periodo_anio=2026,
            periodo_mes=2,
            nivel="subcuenta",
            cuenta_codigo=100,
            saldo_anterior=Decimal("125"),
            saldo_periodo=Decimal("15"),
            saldo_acumulado=Decimal("140"),
        ),
    ]

    balances = build_cash_balance_totals(
        rows,
        months,
        {100: ("1.1.0.0", "Banco")},
    )

    assert balances["saldo_anterior"]["2026-01"] == 150.0
    assert balances["saldo_periodo"]["2026-01"] == 15.0
    assert balances["saldo_final"]["2026-01"] == 165.0
    assert balances["saldo_anterior"]["2026-02"] == 125.0
    assert balances["saldo_final"]["2026-02"] == 140.0
    assert balances["record_counts"]["2026-01"] == 2
    assert len(balances["accounts"]) == 1
    assert balances["accounts"][0]["cuenta_nombre"] == "Banco"
    assert balances["accounts"][0]["saldo_final"]["2026-01"] == 165.0


def test_get_cash_panel_incluye_saldos_sincronizados_de_cuentas_fondo(
    db_session,
    monkeypatch,
):
    from app.models.erp.cuenta import ErpCuenta
    from app.models.erp.rubro import ErpRubro
    rubro = ErpRubro(nombre="Fondos", activo=True)
    db_session.add(rubro)
    db_session.flush()
    db_session.add(ErpCuenta(rubro_id=rubro.id,nro_cuenta=100,cod_cuenta="1.1.0.0",descripcion="Banco"))
    fondo = ErpCashCuenta(descripcion="FONDO BANCOS")
    db_session.add(fondo)
    db_session.flush()
    db_session.add(
        ErpCashMap(
            nro_cta=100,
            moneda="ARS",
            map_debe_id=fondo.id,
            map_haber_id=fondo.id,
        )
    )
    db_session.add_all(
        [
            ErpCashSaldo(
                source_id=10,
                empresa_id=1,
                periodo_anio=2026,
                periodo_mes=1,
                nivel="subcuenta",
                cuenta_codigo=100,
                saldo_anterior=Decimal("1000"),
                saldo_periodo=Decimal("-100"),
                saldo_acumulado=Decimal("900"),
            ),
            ErpCashSaldo(
                source_id=11,
                empresa_id=1,
                periodo_anio=2026,
                periodo_mes=2,
                nivel="subcuenta",
                cuenta_codigo=100,
                saldo_anterior=Decimal("900"),
                saldo_periodo=Decimal("50"),
                saldo_acumulado=Decimal("950"),
            ),
        ]
    )
    db_session.commit()

    panel = get_cash_panel(db_session, "2026-01")

    assert panel["balances"]["saldo_anterior"]["2026-01"] == 1000.0
    assert panel["balances"]["saldo_final"]["2026-01"] == 900.0
    assert panel["balances"]["saldo_anterior"]["2026-02"] == 900.0
    assert panel["balances"]["saldo_final"]["2026-02"] == 950.0
    assert panel["balances"]["accounts"][0]["cuenta_codigo"] == 100
    assert panel["balances"]["accounts"][0]["cuenta_nombre"] == "Banco"
    assert panel["balances"]["accounts"][0]["saldo_final"]["2026-02"] == 950.0


@pytest.mark.parametrize("inicio", ["2026-10", "2026-11", "2026-12"])
def test_panel_en_cierre_conserva_reales_y_alimenta_proyecciones(db_session, monkeypatch, inicio):
    monkeypatch.setattr(
        "app.models.erp.cash_diario_panel._get_source_ledger_accounts", lambda codes: {},
    )
    fondo = ErpCashCuenta(descripcion="FONDO BANCOS", tipo="Fondo")
    ingreso = ErpCashCuenta(descripcion="Cobros", tipo="Ingreso")
    db_session.add_all([fondo, ingreso])
    db_session.flush()
    db_session.add(ErpCashMap(nro_cta=100, moneda="ARS", map_debe_id=fondo.id, map_haber_id=fondo.id))
    db_session.add_all([
        ErpCashPeriodo(fecha_periodo=date(2026, 9, 1), estado="CERRADO"),
        ErpCashPeriodo(fecha_periodo=date(2026, 10, 1), estado="EN_CIERRE"),
        ErpCashPeriodo(fecha_periodo=date(2026, 11, 1), estado="ABIERTO"),
        ErpCashPeriodo(fecha_periodo=date(2026, 12, 1), estado="ABIERTO"),
    ])
    for mes, inicial, final in [(9, "800", "1000"), (10, "1000", "900")]:
        db_session.add(ErpCashSaldo(
            source_id=mes, empresa_id=1, periodo_anio=2026, periodo_mes=mes,
            nivel="subcuenta", cuenta_codigo=100, saldo_anterior=Decimal(inicial),
            saldo_periodo=Decimal(final) - Decimal(inicial), saldo_acumulado=Decimal(final),
        ))
    for mes, importe in [(10, "9999"), (11, "50"), (12, "25")]:
        db_session.add(ErpCashProyectado(
            cuenta_cash_id=ingreso.id, fecha_periodo=date(2026, mes, 1),
             importe_proyectado=Decimal(importe),
        ))
    db_session.commit()

    panel = get_cash_panel(db_session, inicio)
    b = panel["balances"]
    if inicio == "2026-10":
        assert b["saldo_anterior"]["2026-10"] == 1000
        assert b["saldo_final"]["2026-10"] == 900
        assert b["record_counts"]["2026-10"] == 1
        assert b["accounts"][0]["saldo_final"]["2026-10"] == 900
        assert "2026-10" not in b["projected_months"]
        assert panel["periods"]["2026-10"]["estado"] == "EN_CIERRE"
    if inicio != "2026-12":
        assert b["saldo_anterior"]["2026-11"] == 900
        assert b["saldo_final"]["2026-11"] == 950
    assert b["saldo_anterior"]["2026-12"] == 950
    assert b["saldo_final"]["2026-12"] == 975


def test_panel_en_cierre_sin_saldos_no_reemplaza_por_proyeccion(db_session):
    ingreso = ErpCashCuenta(descripcion="Cobros", tipo="Ingreso")
    db_session.add(ingreso)
    db_session.flush()
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, 10, 1), estado="EN_CIERRE"))
    db_session.add(ErpCashProyectado(
        cuenta_cash_id=ingreso.id, fecha_periodo=date(2026, 10, 1),
         importe_proyectado=Decimal("9999"),
    ))
    db_session.commit()
    panel = get_cash_panel(db_session, "2026-10")
    assert panel["periods"]["2026-10"]["estado"] == "EN_CIERRE"
    assert panel["balances"]["record_counts"]["2026-10"] == 0
    assert "2026-10" not in panel["balances"]["projected_months"]
    assert panel["balances"]["saldo_final"]["2026-10"] == 0


def test_get_cash_panel_consulta_rango_y_completa_nombre_desde_maestro_local(db_session, monkeypatch):
    account = ErpCashCuenta(descripcion="Ingresos")
    db_session.add(account)
    db_session.flush()
    def forbidden_external(*args):
        raise AssertionError("El panel debe usar el catálogo local")
    monkeypatch.setattr("app.models.erp.cash_diario_panel._get_source_ledger_accounts", forbidden_external)
    from app.models.erp.cuenta import ErpCuenta
    from app.models.erp.rubro import ErpRubro
    rubro = ErpRubro(nombre="Ingresos", activo=True)
    db_session.add(rubro)
    db_session.flush()
    db_session.add(ErpCuenta(rubro_id=rubro.id,nro_cuenta=4100,cod_cuenta="4.1.0.0",descripcion="Ventas"))


    movements = []
    for source_id, movement_date, amount in (
        (101, date(2026, 8, 1), "10"),
        (102, date(2027, 7, 31), "20"),
        (103, date(2027, 8, 1), "40"),
    ):
        movements.append(
            ErpCashDiario(
                source_id=source_id,
                empresa_id=1,
                fecha=movement_date,
                periodo_anio=movement_date.year,
                periodo_mes=movement_date.month,
                cuenta_codigo=4100,
                debe=Decimal("0"),
                haber=Decimal(f"-{amount}"),
                descripcion="Cobro",
                rubro="03-INGRESOS",
                cuenta_cash_id=account.id,
            )
        )
    db_session.add_all(movements)
    db_session.commit()

    panel = get_cash_panel(db_session, "2026-08")

    assert panel["total"] == 30.0
    assert panel["totals"]["2026-08"] == 10.0
    assert panel["totals"]["2027-07"] == 20.0
    assert panel["groups"][0]["accounts"][0]["movement_count"] == 2
    assert panel["groups"][0]["accounts"][0]["ledger_accounts"][0]["cuenta_nombre"] == "Ventas"

    detail = get_cash_panel_detail(
        db_session,
        "2026-08",
        group_key="INGRESOS",
        filter_cash_account=True,
        cuenta_cash_id=account.id,
        cuenta_codigo=4100,
    )

    assert detail["movement_count"] == 1
    assert detail["total"] == 10.0
    assert detail["movements"][0]["fecha"] == "2026-08-01"
    assert detail["movements"][0]["importe"] == 10.0


def test_cash_panel_y_detalle_excluyen_renglones_sin_importe(db_session, monkeypatch):
    monkeypatch.setattr(
        "app.models.erp.cash_diario_panel._get_source_ledger_accounts", lambda codes: {},
    )
    # Una cuenta sin importe no debe aparecer; otra con movimientos compensados si.
    for source_id, codigo, debe, haber in (
        (901, 24, "0", "0"),
        (902, 25, "10", "0"),
        (903, 25, "0", "-10"),
        (904, 25, "0", "0"),
        (905, 26, "0.01", "0"),
    ):
        db_session.add(ErpCashDiario(
            source_id=source_id, empresa_id=1, fecha=date(2026, 6, 23),
            periodo_anio=2026, periodo_mes=6, cuenta_codigo=codigo,
            debe=Decimal(debe), haber=Decimal(haber), cuenta_cash_id=None,
        ))
    db_session.commit()

    panel = get_cash_panel(db_session, "2026-06")
    sin_cuenta = next(group for group in panel["groups"] if group["key"] == "SIN_CUENTA")
    account = sin_cuenta["accounts"][0]
    assert account["movement_count"] == 3
    assert [row["cuenta_codigo"] for row in account["ledger_accounts"]] == [25, 26]
    assert account["ledger_accounts"][0]["total"] == 0
    assert account["ledger_accounts"][0]["movement_count"] == 2
    assert account["ledger_accounts"][1]["total"] == -0.01

    detail = get_cash_panel_detail(db_session, "2026-06", group_key="SIN_CUENTA")
    assert detail["movement_count"] == 3
    assert detail["total"] == -0.01
    assert all(row["cuenta_cash_id"] is None for row in detail["movements"])
    assert all(row["cuenta_cash_nombre"] is None for row in detail["movements"])
    empty_detail = get_cash_panel_detail(db_session, "2026-06", cuenta_codigo=24)
    assert empty_detail["movement_count"] == 0
    assert empty_detail["movements"] == []


def test_panel_concilia_fondo_sin_mapeo_y_contrapartida_sin_cuenta(db_session):
    fund = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    db_session.add(fund)
    db_session.flush()
    db_session.add_all([
        ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fund.id, map_haber_id=fund.id),
        ErpCashPeriodo(fecha_periodo=date(2026, 6, 1), estado="EN_CIERRE"),
        ErpCashSaldo(source_id=900, empresa_id=1, periodo_anio=2026, periodo_mes=6,
            nivel="subcuenta", cuenta_codigo=1, saldo_anterior=100, saldo_periodo=20,
            saldo_acumulado=120, total_debe=20),
    ])
    for source_id, account, debit, credit in [(901, 1, 20, 0), (902, 4100, 0, -20)]:
        db_session.add(ErpCashDiario(source_id=source_id, empresa_id=1, fecha=date(2026, 6, 1),
            periodo_anio=2026, periodo_mes=6, cuenta_codigo=account,
            debe=debit, haber=credit, cuenta_cash_id=None))
    db_session.commit()
    panel = get_cash_panel(db_session, "2026-06")
    groups = {group["key"]: group for group in panel["groups"]}
    assert groups["FONDOS"]["months"]["2026-06"] == -20
    assert groups["SIN_CUENTA"]["months"]["2026-06"] == 20
    assert panel["balances"]["saldo_anterior"]["2026-06"] + groups["SIN_CUENTA"]["months"]["2026-06"] == panel["balances"]["saldo_final"]["2026-06"]
    assert get_cash_panel_detail(db_session, "2026-06", group_key="FONDOS")["movement_count"] == 1
    assert get_cash_panel_detail(db_session, "2026-06", group_key="SIN_CUENTA")["movement_count"] == 1


def test_cash_panel_detail_filtra_por_cuenta_financiera_y_contable(db_session):
    financial_a = ErpCashCuenta(descripcion="INGR A")
    financial_b = ErpCashCuenta(descripcion="INGR B")
    fondo = ErpCashCuenta(descripcion="FONDO BANCOS")
    db_session.add_all([financial_a, financial_b, fondo])
    db_session.flush()

    movements = [
        ErpCashDiario(
            source_id=201,
            empresa_id=1,
            fecha=date(2026, 8, 5),
            periodo_anio=2026,
            periodo_mes=8,
            cuenta_codigo=4100,
            debe=Decimal("0"),
            haber=Decimal("-10"),
            rubro="03-INGRESOS",
            cuenta_cash_id=financial_a.id,
        ),
        ErpCashDiario(
            source_id=202,
            empresa_id=1,
            fecha=date(2026, 8, 6),
            periodo_anio=2026,
            periodo_mes=8,
            cuenta_codigo=4200,
            debe=Decimal("0"),
            haber=Decimal("-5"),
            rubro="03-INGRESOS",
            cuenta_cash_id=financial_a.id,
        ),
        ErpCashDiario(
            source_id=203,
            empresa_id=1,
            fecha=date(2026, 8, 7),
            periodo_anio=2026,
            periodo_mes=8,
            cuenta_codigo=4100,
            debe=Decimal("0"),
            haber=Decimal("-30"),
            rubro="03-INGRESOS",
            cuenta_cash_id=financial_b.id,
        ),
        ErpCashDiario(
            source_id=204,
            empresa_id=1,
            fecha=date(2026, 8, 7),
            periodo_anio=2026,
            periodo_mes=8,
            cuenta_codigo=1,
            debe=Decimal("45"),
            haber=Decimal("0"),
            rubro="99-OTROS",
            cuenta_cash_id=fondo.id,
        ),
    ]
    db_session.add_all(movements)
    db_session.commit()

    group_detail = get_cash_panel_detail(db_session, "2026-08", group_key="INGRESOS")
    financial_detail = get_cash_panel_detail(
        db_session,
        "2026-08",
        group_key="INGRESOS",
        filter_cash_account=True,
        cuenta_cash_id=financial_a.id,
    )
    ledger_detail = get_cash_panel_detail(
        db_session,
        "2026-08",
        group_key="INGRESOS",
        filter_cash_account=True,
        cuenta_cash_id=financial_a.id,
        cuenta_codigo=4100,
    )
    total_detail = get_cash_panel_detail(db_session, "2026-08")
    fondo_detail = get_cash_panel_detail(db_session, "2026-08", group_key="FONDOS")
    fondo_saldo_detail = get_cash_panel_detail(
        db_session,
        "2026-08",
        group_key="FONDOS",
        cuenta_codigo=1,
        importe_mode="saldo",
    )

    assert (group_detail["movement_count"], group_detail["total"]) == (3, 45.0)
    assert [(row["cuenta_cash_id"], row["cuenta_cash_nombre"]) for row in group_detail["movements"]] == [
        (financial_a.id, "INGR A"),
        (financial_a.id, "INGR A"),
        (financial_b.id, "INGR B"),
    ]
    assert (financial_detail["movement_count"], financial_detail["total"]) == (2, 15.0)
    assert (ledger_detail["movement_count"], ledger_detail["total"]) == (1, 10.0)
    assert (total_detail["movement_count"], total_detail["total"]) == (4, 0.0)
    assert (fondo_detail["movement_count"], fondo_detail["total"]) == (1, -45.0)
    assert (fondo_saldo_detail["movement_count"], fondo_saldo_detail["total"]) == (1, 45.0)
