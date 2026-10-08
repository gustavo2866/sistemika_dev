from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import (
    get_projection_quick_edit,
    projection_months,
    save_projection_quick_edit,
)


def _income_account(db_session) -> ErpCashCuenta:
    account = ErpCashCuenta(descripcion="INGR x VENTAS", tipo="Ingreso")
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def test_quick_edit_returns_24_months_from_selected_year(db_session):
    account = _income_account(db_session)
    db_session.add(
        ErpCashProyectado(
            cuenta_cash_id=account.id,
            fecha_periodo=date(2026, 1, 1),
            tipo="PROYECCION",
            importe=Decimal("125000000"),
        )
    )
    db_session.commit()

    result = get_projection_quick_edit(db_session, int(account.id), 2026)

    assert len(result["values"]) == 24
    assert result["values"][0] == {"periodo": "2026-01-01", "importe": 125000000.0}
    assert result["values"][-1]["periodo"] == "2027-12-01"


def test_quick_edit_creates_and_updates_projection_values(db_session):
    account = _income_account(db_session)
    months = projection_months(2026)
    db_session.add(
        ErpCashProyectado(
            cuenta_cash_id=account.id,
            fecha_periodo=months[0],
            tipo="PROYECCION",
            importe=Decimal("1"),
        )
    )
    db_session.commit()
    values = {month: Decimal(index * 1_000_000) for index, month in enumerate(months, start=1)}

    result = save_projection_quick_edit(db_session, int(account.id), 2026, values)

    assert result["created"] == 23
    assert result["updated"] == 1
    rows = db_session.exec(
        select(ErpCashProyectado)
        .where(ErpCashProyectado.cuenta_cash_id == account.id)
        .order_by(ErpCashProyectado.fecha_periodo)
    ).all()
    assert len(rows) == 24
    assert rows[0].importe == Decimal("1000000.00")
    assert rows[-1].importe == Decimal("24000000.00")


def test_quick_edit_requires_all_24_months(db_session):
    account = _income_account(db_session)
    months = projection_months(2026)

    with pytest.raises(ValueError, match="faltan 2027-12"):
        save_projection_quick_edit(
            db_session,
            int(account.id),
            2026,
            {month: Decimal("0") for month in months[:-1]},
        )
