from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import delete, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.empresa import ErpEmpresa
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.metodo_proyeccion import MetodoProyeccion, MetodoProyeccionDetalle
from app.services.erp_cash_rebuild_service import rebuild_cash


@pytest.fixture(autouse=True)
def no_external_database(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Reconstruir Cash no puede conectarse al ERP")
    monkeypatch.setattr("psycopg.connect", forbidden)


def _real_sources(session):
    fund = ErpCashCuenta(descripcion="Banco", tipo="Fondo")
    income = ErpCashCuenta(descripcion="Cobros", tipo="Ingreso")
    session.add_all([fund, income])
    session.flush()
    session.add_all([
        ErpCashPeriodo(fecha_periodo=date(2026, 10, 1), estado="EN_CIERRE",
            diario_cash_importado=True, mayor_cash_importado=True),
        ErpCashMap(nro_cta=1, moneda="ARS", map_debe_id=fund.id, map_haber_id=fund.id),
        ErpCashMap(nro_cta=4100, moneda="ARS", map_debe_id=income.id, map_haber_id=income.id),
    ])
    now = datetime(2026, 10, 1, tzinfo=timezone.utc)
    for source_id, account, entry, debit, credit in [(1,1,"1",100,0),(2,4100,"1",0,-100),(3,4100,"2",0,-50)]:
        session.add(ErpLibroDiario(source_id=source_id,empresa_id=1,fecha=date(2026,10,1),
            periodo_anio=2026,periodo_mes=10,tipo_asiento="A",nro_asiento=entry,
            nro_renglon=str(source_id),cuenta_codigo=account,debe=Decimal(debit),haber=Decimal(credit),
            cargado_en=now,es_obra=False))
    session.add(ErpLibroMayor(source_id=1,empresa_id=1,periodo_anio=2026,periodo_mes=10,
        nivel="subcuenta",cuenta_codigo=1,total_debe=100,total_haber=0,saldo_anterior=300,
        saldo_periodo=100,saldo_acumulado=400,fecha_periodo=date(2026,10,1),es_obra=False))
    session.commit()
    return fund, income


def test_reconstruye_desde_libros_locales_con_mapeos_vigentes_y_es_idempotente(db_session):
    fund, income = _real_sources(db_session)
    other = ErpCashCuenta(descripcion="Nuevo destino",tipo="Ingreso")
    db_session.add(other)
    db_session.flush()
    mapping = db_session.exec(select(ErpCashMap).where(ErpCashMap.nro_cta==4100)).one()
    mapping.map_haber_id = other.id
    db_session.add(mapping)
    db_session.commit()
    for _ in range(2):
        result = rebuild_cash(db_session,"2026-10","2026-10")
        rows = db_session.exec(select(ErpCashDiario).order_by(ErpCashDiario.source_id)).all()
        assert [(row.source_id,row.cuenta_cash_id) for row in rows] == [(1,fund.id),(2,other.id)]
        assert rows[1].haber == Decimal("-100")
        assert result["movimientos"] == 2
        assert result["saldos"] == 1
        assert db_session.exec(select(ErpCashSaldo)).one().saldo_acumulado == 400
        assert db_session.exec(select(ErpCashPeriodo)).one().estado == "EN_CIERRE"
    assert len(db_session.exec(select(ErpLibroDiario)).all()) == 3


def test_sync_rebuilds_current_actuals_and_future_projections_without_future_books(db_session):
    _, income = _real_sources(db_session)
    method = MetodoProyeccion(nombre="Pendientes", tipo_calculo="PENDIENTE")
    db_session.add(method)
    db_session.flush()
    income.id_metodo_proyeccion = method.id
    db_session.add(income)
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, 11, 1), estado="ABIERTO"))
    future = ErpCashDiario(source_id=999, empresa_id=1, fecha=date(2026, 11, 1),
        periodo_anio=2026, periodo_mes=11, cuenta_codigo=4100, cuenta_cash_id=income.id,
        debe=321, haber=0)
    db_session.add(future)
    db_session.commit()

    from app.routers.erp_cash_diario_router import rebuild_erp_cash
    result = rebuild_erp_cash({"periodo_desde": "2026-10", "periodo_hasta": "2026-12",
        "periodo_reales_hasta": "2026-10"}, db_session)

    assert result["periodos_reales_reconstruidos"] == 1
    db_session.refresh(future)
    assert future.debe == 321
    assert db_session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.fecha_periodo == date(2026, 12, 1))).first() is not None
    # Un mes sin libros locales conserva el Cash existente y no bloquea el resto.
    rebuild_cash(db_session, "2026-10", "2026-12")
    db_session.refresh(future)
    assert future.debe == 321


@pytest.mark.parametrize("actuals_end", ["2026-09", "2027-01"])
def test_reject_actuals_end_outside_rebuild_range(db_session, actuals_end):
    with pytest.raises(ValueError, match="límite de reales"):
        rebuild_cash(db_session, "2026-10", "2026-12", actuals_to=actuals_end)


def test_recalcula_solo_automaticos_y_aplica_metodo_sin_tocar_manuales_ni_cerrados(db_session):
    method = MetodoProyeccion(nombre="Mes anterior")
    db_session.add(method)
    db_session.flush()
    account = ErpCashCuenta(descripcion="Proyección",tipo="Ingreso",id_metodo_proyeccion=method.id)
    db_session.add(account)
    db_session.flush()
    db_session.add_all([MetodoProyeccionDetalle(id_metodo_proyeccion=method.id,mes_destino=3,
        mes_base_desde=-1,mes_base_hasta=-1,funcion="ULTIMO",factor=2),
        ErpCashPeriodo(fecha_periodo=date(2026,1,1),estado="CERRADO")])
    for month, amount, origin in [(1,99,"CALCULADO"),(2,400,"MANUAL"),(3,30,"CALCULADO")]:
        db_session.add(ErpCashProyectado(cuenta_cash_id=account.id,fecha_periodo=date(2026,month,1),
            importe_proyectado=amount,origen_proyectado=origin,importe_comprometido=7,
            observacion="Conservar"))
    db_session.commit()
    result = rebuild_cash(db_session,"2026-01","2026-03")
    rows = db_session.exec(select(ErpCashProyectado).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert [row.importe_proyectado for row in rows] == [99,400,800]
    assert rows[0].id_metodo_proyeccion is None
    assert rows[1].id_metodo_proyeccion == method.id
    assert all(row.importe_comprometido == 7 and row.observacion == "Conservar" for row in rows)
    assert rows[2].total_proyectado == 807
    assert result["proyecciones_calculadas"] == 1
    assert result["proyecciones_manuales_conservadas"] == 1
    assert result["periodos_cerrados_omitidos"] == 1


def test_reasigna_pendientes_y_limpia_destino_anterior_sin_cambiar_cerrados(db_session):
    method = MetodoProyeccion(nombre="Pendiente",tipo_calculo="PENDIENTE")
    company = ErpEmpresa(empresa_id=1,empresa_nombre="Test",grupo="wcl")
    old = ErpCashCuenta(descripcion="Anterior",tipo="Ingreso")
    db_session.add_all([method,company,old])
    db_session.flush()
    new = ErpCashCuenta(descripcion="Actual",tipo="Ingreso",id_metodo_proyeccion=method.id)
    db_session.add(new)
    db_session.flush()
    db_session.add_all([
        ErpCashMap(nro_cta=4100,moneda="ARS",map_debe_id=new.id,map_haber_id=new.id),
        ErpCashPendientesInput(erp_empresa_id=company.id,cuenta_cash_id=old.id,
            source_name="test",file_name="test.csv",row_number=1,nrocta_raw="4100",
            saldo_raw="50",fecvenc_raw="15/11/2026",is_valid=True),
        ErpCashPeriodo(fecha_periodo=date(2026,10,1),estado="CERRADO"),
        ErpCashProyectado(cuenta_cash_id=old.id,fecha_periodo=date(2026,10,1),importe_pendiente=99),
        ErpCashProyectado(cuenta_cash_id=old.id,fecha_periodo=date(2026,11,1),importe_pendiente=50,
            importe_proyectado=100,importe_comprometido=5),
    ])
    db_session.commit()
    rebuild_cash(db_session,"2026-10","2026-11")
    rows={(r.cuenta_cash_id,r.fecha_periodo):r for r in db_session.exec(select(ErpCashProyectado)).all()}
    assert rows[(old.id,date(2026,10,1))].importe_pendiente == 99
    assert rows[(old.id,date(2026,11,1))].importe_pendiente == 0
    assert rows[(old.id,date(2026,11,1))].importe_comprometido == 5
    assert rows[(new.id,date(2026,11,1))].total_proyectado == 50


def test_libros_locales_sin_marca_completa_se_reconstruyen(db_session):
    _,_ = _real_sources(db_session)
    rebuild_cash(db_session,"2026-10","2026-10")
    period=db_session.exec(select(ErpCashPeriodo)).one()
    period.mayor_cash_importado=False
    db_session.add(period)
    db_session.commit()
    result = rebuild_cash(db_session,"2026-10","2026-10")
    assert result["periodos_reales_reconstruidos"] == 1
    assert len(db_session.exec(select(ErpCashDiario)).all()) == 2
    assert len(db_session.exec(select(ErpCashSaldo)).all()) == 1


@pytest.mark.parametrize("missing_model,flag", [
    (ErpLibroMayor, "mayor_cash_importado"),
    (ErpLibroDiario, "diario_cash_importado"),
])
def test_libro_no_importado_conserva_su_cash_y_actualiza_el_otro(db_session, missing_model, flag):
    _real_sources(db_session)
    rebuild_cash(db_session, "2026-10", "2026-10")
    period = db_session.exec(select(ErpCashPeriodo)).one()
    setattr(period, flag, False)
    db_session.add(period)
    db_session.exec(delete(missing_model))
    if missing_model is ErpLibroMayor:
        row = db_session.exec(select(ErpLibroDiario).where(ErpLibroDiario.source_id == 2)).one()
        row.haber = Decimal("-200")
    else:
        row = db_session.exec(select(ErpLibroMayor)).one()
        row.saldo_acumulado = Decimal("900")
    db_session.add(row)
    db_session.commit()

    rebuild_cash(db_session, "2026-10", "2026-10")

    income = db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 2)).one()
    balance = db_session.exec(select(ErpCashSaldo)).one()
    assert income.haber == (-200 if missing_model is ErpLibroMayor else -100)
    assert balance.saldo_acumulado == (400 if missing_model is ErpLibroMayor else 900)


def test_actualiza_noviembre_parcial_sin_periodo_ni_marcas_de_importacion(db_session):
    _, income = _real_sources(db_session)
    db_session.add_all([
        ErpLibroDiario(source_id=100, empresa_id=1, fecha=date(2026, 11, 1),
            periodo_anio=2026, periodo_mes=11, tipo_asiento="A", nro_asiento="10",
            nro_renglon="1", cuenta_codigo=1, debe=25, haber=0, es_obra=False),
        ErpLibroDiario(source_id=101, empresa_id=1, fecha=date(2026, 11, 1),
            periodo_anio=2026, periodo_mes=11, tipo_asiento="A", nro_asiento="10",
            nro_renglon="2", cuenta_codigo=4100, debe=0, haber=-25, es_obra=False),
    ])
    db_session.commit()

    result = rebuild_cash(db_session, "2026-10", "2026-12")

    assert result["periodos_reales_reconstruidos"] == 2
    row = db_session.exec(select(ErpCashDiario).where(ErpCashDiario.source_id == 101)).one()
    assert row.cuenta_cash_id == income.id and row.haber == -25
    october = db_session.exec(select(ErpCashPeriodo).where(ErpCashPeriodo.fecha_periodo == date(2026, 10, 1))).one()
    assert october.estado == "EN_CIERRE"


@pytest.mark.parametrize("include_closed", [False, True])
def test_fallo_proyeccion_revierte_toda_la_reconstruccion(db_session, include_closed):
    _,income=_real_sources(db_session)
    rebuild_cash(db_session,"2026-10","2026-10")
    old_ids=[row.id for row in db_session.exec(select(ErpCashDiario)).all()]
    if include_closed:
        period = db_session.exec(select(ErpCashPeriodo)).one()
        period.estado = "CERRADO"
        db_session.add(period)
    method=MetodoProyeccion(nombre="Sin reglas")
    db_session.add(method)
    db_session.flush()
    income.id_metodo_proyeccion=method.id
    db_session.add(income)
    db_session.add(ErpCashProyectado(cuenta_cash_id=income.id,fecha_periodo=date(2026,10,1),
        importe_proyectado=123,origen_proyectado="CALCULADO"))
    db_session.commit()
    with pytest.raises(ValueError,match="regla"):
        rebuild_cash(db_session,"2026-10","2026-10", include_closed=include_closed)
    assert [row.id for row in db_session.exec(select(ErpCashDiario)).all()] == old_ids
    assert db_session.exec(select(ErpCashProyectado)).one().importe_proyectado == 123


def test_rango_cerrado_no_modifica_asignaciones_ni_pendientes(db_session):
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026,10,1),estado="CERRADO"))
    row=ErpCashProyectado(cuenta_cash_id=1,fecha_periodo=date(2026,10,1),importe_pendiente=123)
    db_session.add(row)
    db_session.commit()
    result=rebuild_cash(db_session,"2026-10","2026-10")
    db_session.refresh(row)
    assert row.importe_pendiente == 123
    assert result["periodos_cerrados_omitidos"] == 1
    assert result["pendientes_reasignados"] == 0


@pytest.mark.parametrize("start,end",[("2026-03","2026-01"),("2024-01","2026-01"),("2026-00","2026-01")])
def test_rango_invalido(db_session,start,end):
    with pytest.raises(ValueError):
        rebuild_cash(db_session,start,end)


def test_reconstruccion_historica_conserva_reales_y_mapeos_de_periodos_cerrados(db_session):
    _, income = _real_sources(db_session)
    rebuild_cash(db_session, "2026-10", "2026-10")
    period = db_session.exec(select(ErpCashPeriodo)).one()
    closed_at = datetime(2026, 11, 1, tzinfo=timezone.utc)
    period.estado = "CERRADO"
    period.cerrado_en = closed_at
    other = ErpCashCuenta(descripcion="Nuevo destino", tipo="Ingreso")
    db_session.add_all([period, other])
    db_session.flush()
    mapping = db_session.exec(select(ErpCashMap).where(ErpCashMap.nro_cta == 4100)).one()
    mapping.map_haber_id = other.id
    db_session.add(mapping)
    manual = ErpCashProyectado(cuenta_cash_id=income.id, fecha_periodo=date(2026, 10, 1),
        importe_proyectado=321, importe_pendiente=45, importe_comprometido=7, observacion="Conservar")
    db_session.add(manual)
    db_session.commit()
    previous_version = period.version

    from app.routers.erp_cash_diario_router import rebuild_erp_cash

    for _ in range(2):
        result = rebuild_erp_cash({"periodo_desde": "2026-10", "periodo_hasta": "2026-10",
            "incluir_cerrados": True}, db_session)
        rows = db_session.exec(select(ErpCashDiario).where(ErpCashDiario.cuenta_codigo == 4100)).all()
        assert len(rows) == 1 and rows[0].cuenta_cash_id == income.id
        db_session.refresh(period)
        db_session.refresh(manual)
        assert period.estado == "CERRADO"
        assert period.cerrado_en.replace(tzinfo=timezone.utc) == closed_at
        assert period.version == previous_version
        assert (manual.importe_proyectado, manual.importe_pendiente, manual.importe_comprometido) == (321, 45, 7)
        assert manual.observacion == "Conservar"
        assert result["periodos_cerrados_reconstruidos"] == 0
        assert result["periodos_cerrados_omitidos"] == 1


def test_reconstruccion_historica_recalcula_automaticos_y_bases_reales(db_session):
    _, income = _real_sources(db_session)
    rebuild_cash(db_session, "2026-10", "2026-10")
    period = db_session.exec(select(ErpCashPeriodo)).one()
    period.estado = "CERRADO"
    method = MetodoProyeccion(nombre="Duplicar anterior")
    db_session.add_all([period, method])
    db_session.flush()
    income.id_metodo_proyeccion = method.id
    db_session.add(income)
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, 9, 1), estado="CERRADO"))
    for month in (10, 11):
        db_session.add(MetodoProyeccionDetalle(id_metodo_proyeccion=method.id, mes_destino=month,
            mes_base_desde=-1, mes_base_hasta=-1, funcion="ULTIMO", factor=2))
        db_session.add(ErpCashProyectado(cuenta_cash_id=income.id, fecha_periodo=date(2026, month, 1),
            importe_proyectado=30, origen_proyectado="CALCULADO", importe_comprometido=7))
    db_session.commit()

    result = rebuild_cash(db_session, "2026-10", "2026-11", include_closed=True)
    rows = db_session.exec(select(ErpCashProyectado).order_by(ErpCashProyectado.fecha_periodo)).all()
    assert [row.importe_proyectado for row in rows] == [0, 200]
    assert [row.total_proyectado for row in rows] == [7, 207]
    assert all(row.id_metodo_proyeccion == method.id for row in rows)
    assert result["proyecciones_calculadas"] == 2


def test_reconstruccion_historica_usa_libros_disponibles_sin_reabrir_cerrados(db_session):
    _real_sources(db_session)
    rebuild_cash(db_session, "2026-10", "2026-10")
    period = db_session.exec(select(ErpCashPeriodo)).one()
    period.estado = "CERRADO"
    period.mayor_cash_importado = False
    db_session.add(period)
    db_session.commit()
    rebuild_cash(db_session, "2026-10", "2026-10", include_closed=True)
    assert len(db_session.exec(select(ErpCashDiario)).all()) == 2
    assert db_session.exec(select(ErpCashSaldo)).one().saldo_acumulado == 400
    db_session.refresh(period)
    assert period.estado == "CERRADO"


@pytest.mark.parametrize("include_closed", [False, True])
def test_diciembre_2025_se_conserva_como_base(db_session, include_closed):
    _real_sources(db_session)
    base = ErpCashSaldo(source_id=999, empresa_id=1, periodo_anio=2025, periodo_mes=12,
        nivel="subcuenta", cuenta_codigo=1, saldo_acumulado=1234)
    period = ErpCashPeriodo(fecha_periodo=date(2025, 12, 1), estado="CERRADO")
    projection = ErpCashProyectado(cuenta_cash_id=1, fecha_periodo=date(2025, 12, 1),
        importe_proyectado=111, origen_proyectado="CALCULADO")
    db_session.add_all([base, period, projection])
    db_session.commit()

    result = rebuild_cash(db_session, "2025-12", "2026-10", include_closed=include_closed)
    for row in (base, period, projection):
        db_session.refresh(row)
    assert base.saldo_acumulado == 1234
    assert period.ultima_sincronizacion is None
    assert period.estado == "CERRADO"
    assert projection.importe_proyectado == 111
    assert result["periodo_desde"] == "2026-01"


def test_rango_historico_puede_superar_24_meses(db_session):
    result = rebuild_cash(db_session, "2025-12", "2028-01", include_closed=True)
    assert result["periodo_desde"] == "2026-01"
    assert result["periodo_hasta"] == "2028-01"


def test_router_rechaza_flag_de_cerrados_que_no_sea_booleano(db_session):
    from fastapi import HTTPException
    from app.routers.erp_cash_diario_router import rebuild_erp_cash

    with pytest.raises(HTTPException) as error:
        rebuild_erp_cash({"periodo_desde": "2026-10", "periodo_hasta": "2026-10",
            "incluir_cerrados": "false"}, db_session)
    assert error.value.status_code == 400
