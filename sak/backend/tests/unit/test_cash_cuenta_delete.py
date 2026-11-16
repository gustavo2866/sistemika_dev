from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.routers.erp_cash_cuenta_router import erp_cash_cuenta_crud as accounts


@pytest.mark.parametrize("hard", [False, True])
@pytest.mark.parametrize("deleted_projection", [False, True])
def test_reject_delete_account_with_projection(db_session, hard, deleted_projection):
    account = accounts.create(db_session, {"descripcion": "Cuenta con proyección"})
    db_session.add(ErpCashProyectado(
        cuenta_cash_id=account.id,
        fecha_periodo=date(2026, 3, 1),
        deleted_at=datetime.now(timezone.utc) if deleted_projection else None,
    ))
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        accounts.delete(db_session, account.id, hard=hard)

    assert error.value.status_code == 409
    assert "Cash proyectado" in error.value.detail
    db_session.refresh(account)
    assert account.deleted_at is None


@pytest.mark.parametrize("hard", [False, True])
def test_delete_account_without_projection(db_session, hard):
    account = accounts.create(db_session, {"descripcion": "Sin proyección"})
    other = accounts.create(db_session, {"descripcion": "Otra cuenta"})
    db_session.add(ErpCashProyectado(cuenta_cash_id=other.id, fecha_periodo=date(2026, 3, 1)))
    db_session.commit()
    account_id = account.id

    assert accounts.delete(db_session, account_id, hard=hard)
    if hard:
        assert db_session.get(ErpCashCuenta, account_id) is None
    else:
        db_session.refresh(account)
        assert account.deleted_at is not None
