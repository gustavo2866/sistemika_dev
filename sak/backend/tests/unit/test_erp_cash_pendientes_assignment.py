from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_map import ErpCashMap
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.cash_subcta import ErpCashSubcta
from app.models.erp.empresa import ErpEmpresa
from app.services.erp_cash_pendientes_assignment_service import (
    assign_cash_accounts_to_pendientes,
)


def _pending(empresa_id: int, row_number: int, **values) -> ErpCashPendientesInput:
    return ErpCashPendientesInput(
        erp_empresa_id=empresa_id,
        source_name="cash_pendientes",
        file_name="pendientes.csv",
        row_number=row_number,
        nrocta_raw=values.get("nrocta_raw", "1392"),
        tipsub_raw=values.get("tipsub_raw"),
        nrosub_raw=values.get("nrosub_raw"),
        saldo_raw=values.get("saldo_raw", "0"),
    )


def test_assign_cash_accounts_reutiliza_categoria_fallback_y_lado_del_mapeo(db_session):
    empresa = ErpEmpresa(empresa_id=1, empresa_nombre="BATIA", grupo="wcl")
    general_debe = ErpCashCuenta(tipo="Egreso", descripcion="General debe")
    general_haber = ErpCashCuenta(tipo="Ingreso", descripcion="General haber")
    specific_debe = ErpCashCuenta(tipo="Egreso", descripcion="Obras debe")
    specific_haber = ErpCashCuenta(tipo="Ingreso", descripcion="Obras haber")
    db_session.add_all(
        [empresa, general_debe, general_haber, specific_debe, specific_haber]
    )
    db_session.commit()

    db_session.add_all(
        [
            ErpCashMap(
                nro_cta=1392,
                moneda="ARS",
                categoria=None,
                map_debe_id=general_debe.id,
                map_haber_id=general_haber.id,
            ),
            ErpCashMap(
                nro_cta=1392,
                moneda="ARS",
                categoria="obras",
                map_debe_id=specific_debe.id,
                map_haber_id=specific_haber.id,
            ),
            ErpCashSubcta(
                tpo_subcta=1,
                nro_subcta=1238,
                descripcion="Proveedor de obras",
                categoria=" Obras ",
            ),
            _pending(
                empresa.id,
                2,
                tipsub_raw="1",
                nrosub_raw="1238",
                saldo_raw="-59.310,25",
            ),
            _pending(
                empresa.id,
                3,
                tipsub_raw="1",
                nrosub_raw="9999",
                saldo_raw="1200,50",
            ),
            _pending(empresa.id, 4, nrocta_raw="invalida", saldo_raw="10"),
            _pending(empresa.id, 5, saldo_raw="0"),
        ]
    )
    db_session.commit()

    result = assign_cash_accounts_to_pendientes(
        db_session,
        erp_empresa_id=empresa.id,
    )

    rows = db_session.exec(
        select(ErpCashPendientesInput).order_by(ErpCashPendientesInput.row_number)
    ).all()
    assert rows[0].cuenta_cash_id == specific_haber.id
    assert rows[1].cuenta_cash_id == general_debe.id
    assert rows[2].cuenta_cash_id is None
    assert rows[3].cuenta_cash_id is None
    assert result == {
        "erp_empresa_id": empresa.id,
        "overwrite": False,
        "rows_processed": 4,
        "rows_assigned": 2,
        "rows_unchanged": 0,
        "rows_unmapped": 1,
        "rows_invalid": 1,
        "rows_blocked": 0,
    }


def test_assignment_respeta_bloqueo_incluso_con_overwrite_y_mapeo_fondo(db_session):
    from datetime import datetime, timezone

    empresa = ErpEmpresa(empresa_id=1, empresa_nombre="BATIA", grupo="wcl")
    fondo = ErpCashCuenta(tipo="Fondo", descripcion="Banco")
    blocked = ErpCashSubcta(tpo_subcta=1, nro_subcta=4566, descripcion="Bloqueada", categoria="Obras",
                           estado="bloqueada", deleted_at=datetime.now(timezone.utc))
    db_session.add_all([empresa, fondo, blocked])
    db_session.flush()
    db_session.add(ErpCashMap(nro_cta=1392, moneda="ARS", map_debe_id=fondo.id, map_haber_id=fondo.id))
    assigned = _pending(empresa.id, 1, tipsub_raw="01", nrosub_raw="04566", saldo_raw="10")
    assigned.cuenta_cash_id = fondo.id
    unassigned = _pending(empresa.id, 2, tipsub_raw="1", nrosub_raw="4566", saldo_raw="20")
    db_session.add_all([assigned, unassigned])
    db_session.commit()
    version = assigned.version
    result = assign_cash_accounts_to_pendientes(db_session, overwrite=True)
    assert result["rows_blocked"] == 2
    assert assigned.cuenta_cash_id == fondo.id
    assert assigned.version == version
    assert unassigned.cuenta_cash_id is None
    blocked.estado = "activa"
    blocked.deleted_at = None
    db_session.add(blocked)
    db_session.commit()
    result = assign_cash_accounts_to_pendientes(db_session)
    assert result["rows_assigned"] == 1
    assert unassigned.cuenta_cash_id == fondo.id
