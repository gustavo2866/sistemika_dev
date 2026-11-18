from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado


def test_erp_cash_proyectado_rechaza_fecha_que_no_inicia_el_mes():
    with pytest.raises(ValidationError, match="primer dia del mes"):
        ErpCashProyectado.model_validate({"cuenta_cash_id": 12, "fecha_periodo": date(2026, 1, 15)})


def test_nuevos_periodos_tienen_manual_apagado_por_modelo_sql_y_crud(db_session):
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_crud

    account = ErpCashCuenta(descripcion="Automatico por defecto")
    db_session.add(account)
    db_session.flush()
    row = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 10, 1))
    assert row.origen_proyectado == "CALCULADO"
    db_session.add(row)
    db_session.flush()
    db_session.connection().exec_driver_sql(
        "INSERT INTO erp_cash_proyectado (cuenta_cash_id, fecha_periodo, created_at, updated_at, version) "
        "VALUES (?, '2026-11-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)", (account.id,),
    )
    origin = db_session.connection().exec_driver_sql(
        "SELECT origen_proyectado FROM erp_cash_proyectado WHERE fecha_periodo = '2026-11-01'",
    ).scalar_one()
    assert origin == "CALCULADO"
    created = erp_cash_proyectado_crud.create(db_session, {
        "cuenta_cash_id": account.id, "fecha_periodo": "2026-12-01", "importe_proyectado": 100,
    })
    assert created.origen_proyectado == "CALCULADO"
    manual = erp_cash_proyectado_crud.create(db_session, {
        "cuenta_cash_id": account.id, "fecha_periodo": "2027-01-01", "origen_proyectado": "MANUAL",
    })
    assert manual.origen_proyectado == "MANUAL"


def test_crud_descarta_detalle_auto_y_conserva_descripcion_manual(db_session):
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_crud as crud

    account = ErpCashCuenta(descripcion="Sin detalles automaticos")
    db_session.add(account)
    db_session.commit()
    row = crud.create(db_session, {
        "cuenta_cash_id": account.id, "fecha_periodo": "2026-10-01",
        "observacion": "AUTO: base real", "importe_comprometido": 10,
    })
    assert row.observacion is None
    row = crud.update(db_session, row.id, {"observacion": "Nota del usuario"})
    assert row.observacion == "Nota del usuario"
    row = crud.update(db_session, row.id, {"observacion": "  auto: texto anterior"})
    assert row.observacion is None
    assert row.importe_comprometido == 10


@pytest.mark.parametrize("base,total", [("HISTORICO", "120.50"), ("PENDIENTE", "50.75")])
def test_total_generado_por_la_base_y_actualizado_por_sql(db_session, base, total):
    account = ErpCashCuenta(descripcion="Total generado")
    db_session.add(account)
    db_session.flush()
    row = ErpCashProyectado(
        cuenta_cash_id=account.id, fecha_periodo=date(2026, 1, 1), tipo_calculo=base,
        importe_proyectado=Decimal("100.25"), importe_pendiente=Decimal("30.50"),
        importe_comprometido=Decimal("20.25"),
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    assert row.total_proyectado == Decimal(total)
    # Consumidor externo: sin servicios Python ni hooks ORM.
    db_session.connection().exec_driver_sql("UPDATE erp_cash_proyectado SET importe_comprometido = -10 WHERE id = ?", (row.id,))
    db_session.refresh(row)
    assert row.total_proyectado == Decimal(total) - Decimal("30.25")
    db_session.connection().exec_driver_sql("UPDATE erp_cash_proyectado SET tipo_calculo = 'PENDIENTE' WHERE id = ?", (row.id,))
    db_session.refresh(row)
    assert row.total_proyectado == Decimal("20.50")


def test_cuenta_periodo_unico_y_total_no_editable(db_session):
    account = ErpCashCuenta(descripcion="Unicidad")
    db_session.add(account)
    db_session.flush()
    row = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 1, 1))
    db_session.add(row)
    db_session.commit()
    with pytest.raises(OperationalError), db_session.begin_nested():
        db_session.connection().exec_driver_sql("UPDATE erp_cash_proyectado SET total_proyectado = 999 WHERE id = ?", (row.id,))
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.add(ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=row.fecha_periodo))
        db_session.flush()


def test_crud_resuelve_metodo_y_no_acepta_total_del_cliente(db_session):
    from app.models.metodo_proyeccion import MetodoProyeccion
    from app.routers.erp_cash_proyectado_router import erp_cash_proyectado_crud

    method = MetodoProyeccion(nombre="Pendiente", tipo_calculo="PENDIENTE")
    db_session.add(method)
    db_session.flush()
    account = ErpCashCuenta(descripcion="CRUD total", id_metodo_proyeccion=method.id)
    db_session.add(account)
    db_session.commit()
    row = erp_cash_proyectado_crud.create(db_session, {
        "cuenta_cash_id": account.id, "fecha_periodo": "2026-11-01",
        "importe_proyectado": 999, "importe_pendiente": 20, "importe_comprometido": 5,
        "total_proyectado": 9999, "tipo_calculo": "HISTORICO",
    })
    assert row.tipo_calculo == "PENDIENTE"
    assert row.id_metodo_proyeccion == method.id
    assert row.total_proyectado == Decimal("25")
    row = erp_cash_proyectado_crud.update(db_session, row.id, {
        "importe_comprometido": -5, "total_proyectado": 9999,
        "tipo_calculo": "HISTORICO",
    })
    assert row.tipo_calculo == "PENDIENTE"
    assert row.total_proyectado == Decimal("15")
