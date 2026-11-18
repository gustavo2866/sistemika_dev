from datetime import date
from decimal import Decimal

from sqlmodel import select

from app.models.base import current_utc_time
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.empresa import ErpEmpresa
from app.models.erp.cash_subcta import ErpCashSubcta
from app.services.erp_cash_pendientes_projection_service import (
    get_pending_projection_detail,
    rebuild_pending_cash_projection,
)


def _pending(
    empresa_id: int,
    cuenta_cash_id: int | None,
    row_number: int,
    vencimiento: str,
    saldo: str,
    *,
    is_valid: bool = True,
) -> ErpCashPendientesInput:
    return ErpCashPendientesInput(
        erp_empresa_id=empresa_id,
        cuenta_cash_id=cuenta_cash_id,
        source_name="cash_pendientes",
        file_name="pendientes.csv",
        row_number=row_number,
        fecvenc_raw=vencimiento,
        saldo_raw=saldo,
        is_valid=is_valid,
    )


def test_projection_y_detalle_excluyen_bloqueadas_previamente_asignadas(db_session):
    empresa = ErpEmpresa(empresa_id=1, empresa_nombre="BATIA", grupo="wcl")
    account = ErpCashCuenta(tipo="Egreso", descripcion="Obras")
    blocked = ErpCashSubcta(tpo_subcta=1, nro_subcta=4566, descripcion="Bloqueada", estado="bloqueada", categoria="Obras")
    db_session.add_all([empresa, account, blocked])
    db_session.flush()
    item = _pending(empresa.id, account.id, 1, "15/04/2026", "50")
    item.tipsub_raw, item.nrosub_raw = "01", "04566"
    existing = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=date(2026, 4, 1),
                               importe_pendiente=Decimal("50"), importe_proyectado=Decimal("100"))
    db_session.add_all([item, existing, ErpCashPeriodo(fecha_periodo=date(2026, 3, 1), estado="CERRADO")])
    db_session.commit()
    result = rebuild_pending_cash_projection(db_session)
    assert result["inputs_blocked"] == 1
    assert existing.importe_pendiente == 0
    assert existing.importe_proyectado == Decimal("100")
    assert item.cuenta_cash_id == account.id
    detail = get_pending_projection_detail(db_session, cuenta_cash_id=account.id,
                                          fecha_desde=date(2026, 4, 1), fecha_hasta=date(2026, 4, 30))
    assert detail["count"] == 0
    blocked.estado = "activa"
    db_session.add(blocked)
    db_session.commit()
    rebuild_pending_cash_projection(db_session)
    assert existing.importe_pendiente == Decimal("50")
    detail = get_pending_projection_detail(db_session, cuenta_cash_id=account.id,
                                          fecha_desde=date(2026, 4, 1), fecha_hasta=date(2026, 4, 30))
    assert detail["count"] == 1


def test_detalle_sin_fechas_incluye_todos_los_pendientes_de_la_cuenta(db_session):
    empresa = ErpEmpresa(empresa_id=1, empresa_nombre="BATIA", grupo="wcl")
    account = ErpCashCuenta(tipo="Egreso", descripcion="Cuenta A")
    other = ErpCashCuenta(tipo="Egreso", descripcion="Cuenta B")
    blocked = ErpCashSubcta(tpo_subcta=1, nro_subcta=4566, descripcion="Bloqueada", estado="bloqueada")
    db_session.add_all([empresa, account, other, blocked])
    db_session.flush()
    historical = _pending(empresa.id, account.id, 1, "15/01/2025", "10")
    current = _pending(empresa.id, account.id, 2, "20/04/2026", "20")
    future = _pending(empresa.id, account.id, 3, "15/01/2030", "30")
    blocked_item = _pending(empresa.id, account.id, 4, "20/04/2026", "100")
    blocked_item.tipsub_raw, blocked_item.nrosub_raw = "1", "4566"
    deleted = _pending(empresa.id, account.id, 5, "20/04/2026", "200")
    deleted.deleted_at = current_utc_time()
    db_session.add_all([
        historical, current, future, blocked_item, deleted,
        _pending(empresa.id, other.id, 6, "20/04/2026", "300"),
        _pending(empresa.id, account.id, 7, "20/04/2026", "400", is_valid=False),
    ])
    db_session.commit()

    detail = get_pending_projection_detail(db_session, cuenta_cash_id=account.id)
    assert detail["fecha_desde"] is None
    assert detail["fecha_hasta"] is None
    assert [item["id"] for item in detail["data"]] == [historical.id, current.id, future.id]
    assert detail["importe_total"] == "60.00"

    monthly = get_pending_projection_detail(
        db_session, cuenta_cash_id=account.id,
        fecha_desde=date(2026, 4, 1), fecha_hasta=date(2026, 4, 30),
    )
    assert monthly["count"] == 1
    assert monthly["importe_total"] == "20.00"
    overdue = get_pending_projection_detail(
        db_session, cuenta_cash_id=account.id, fecha_hasta=date(2026, 4, 30),
    )
    assert overdue["count"] == 2
    assert overdue["importe_total"] == "30.00"


def test_rebuild_pending_projection_limpia_acumula_y_traslada_periodos_cerrados(
    db_session,
):
    empresa = ErpEmpresa(empresa_id=1, empresa_nombre="BATIA", grupo="wcl")
    account_a = ErpCashCuenta(tipo="Egreso", descripcion="Cuenta A")
    account_b = ErpCashCuenta(tipo="Ingreso", descripcion="Cuenta B")
    db_session.add_all([empresa, account_a, account_b])
    db_session.commit()

    db_session.add_all(
        [
            ErpCashPeriodo(fecha_periodo=date(2026, 2, 1), estado="CERRADO"),
            ErpCashPeriodo(fecha_periodo=date(2026, 3, 1), estado="CERRADO"),
            _pending(empresa.id, account_a.id, 2, "15/01/2026", "10,50"),
            _pending(empresa.id, account_a.id, 3, "31/03/2026", "-2,50"),
            _pending(empresa.id, account_a.id, 4, "20/04/2026", "5"),
            _pending(empresa.id, account_a.id, 5, "15/05/2026", "7"),
            _pending(empresa.id, account_b.id, 6, "01/04/2026", "4"),
            _pending(empresa.id, None, 7, "01/04/2026", "99"),
            _pending(empresa.id, account_b.id, 8, "fecha-invalida", "1"),
            ErpCashProyectado(
                cuenta_cash_id=account_b.id,
                fecha_periodo=date(2025, 1, 1),
                importe_pendiente=Decimal("999"),
            ),
            ErpCashProyectado(
                cuenta_cash_id=account_b.id,
                fecha_periodo=date(2026, 4, 1),
                importe_proyectado=Decimal("100"),
                importe_comprometido=Decimal("20"),
            ),
        ]
    )
    db_session.commit()

    result = rebuild_pending_cash_projection(db_session)

    pending_rows = db_session.exec(
        select(ErpCashProyectado)
        .where(ErpCashProyectado.importe_pendiente != 0)
        .order_by(
            ErpCashProyectado.cuenta_cash_id,
            ErpCashProyectado.fecha_periodo,
        )
    ).all()
    values = {
        (row.cuenta_cash_id, row.fecha_periodo): Decimal(row.importe_pendiente)
        for row in pending_rows
    }
    assert values == {
        (account_a.id, date(2026, 4, 1)): Decimal("13.00"),
        (account_a.id, date(2026, 5, 1)): Decimal("7.00"),
        (account_b.id, date(2026, 4, 1)): Decimal("4.00"),
    }
    projection = db_session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.importe_proyectado != 0
        )
    ).one()
    assert Decimal(projection.importe_proyectado) == Decimal("100")
    assert projection.importe_comprometido == Decimal("20")
    assert projection.importe_pendiente == Decimal("4")
    assert projection.total_proyectado == Decimal("120")
    assert result == {
        "ultimo_periodo_cerrado": "2026-03-01",
        "primer_periodo_abierto": "2026-04-01",
        "inputs_processed": 7,
        "inputs_unmapped": 1,
        "inputs_invalid": 1,
        "inputs_blocked": 0,
        "inputs_rolled_to_first_open": 2,
        "rows_reset": 1,
        "rows_updated": 2,
        "rows_created": 2,
        "zero_groups_omitted": 0,
    }

    detail = get_pending_projection_detail(
        db_session,
        cuenta_cash_id=account_a.id,
        fecha_desde=date(1900, 1, 1),
        fecha_hasta=date(2026, 4, 30),
    )
    assert detail["count"] == 3
    assert detail["importe_total"] == "13.00"
    assert "descripcion" in detail["data"][0]
    assert [row["fecha_vencimiento"] for row in detail["data"]] == [
        "2026-01-15",
        "2026-03-31",
        "2026-04-20",
    ]
    assert all(row["empresa"] == "BATIA" for row in detail["data"])
