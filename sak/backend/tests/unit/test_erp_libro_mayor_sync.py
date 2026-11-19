from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from sqlalchemy import event

from sqlmodel import select

from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.libro_mayor_sync import SOURCE_QUERY, sync_libro_mayor_periodo
from app.routers import erp_libro_mayor_router
from app.models.erp import libro_mayor_sync
from app.models.erp.cash_periodo import ErpCashPeriodo


def _libro_mayor_row(source_id: int, anio: int, mes: int) -> dict:
    return {
        "source_id": source_id,
        "empresa_id": 1,
        "periodo_anio": anio,
        "periodo_mes": mes,
        "nivel": "cuenta",
        "cuenta_codigo": 110101,
        "tipo_subcuenta": None,
        "nro_subcuenta": None,
        "centro_costo": None,
        "total_debe": Decimal("150.25"),
        "total_haber": Decimal("25"),
        "saldo_periodo": Decimal("125.25"),
        "saldo_acumulado": Decimal("1125.25"),
        "recalculado_en": datetime(2026, 8, 31, tzinfo=timezone.utc),
        "saldo_anterior": Decimal("1000"),
        "fecha_periodo": date(anio, mes, 1),
    }


def test_sync_libro_mayor_periodo_reemplaza_solo_periodo_objetivo(db_session):
    db_session.add_all(
        [
            ErpLibroMayor(**_libro_mayor_row(1, 2026, 8)),
            ErpLibroMayor(**_libro_mayor_row(2, 2026, 7)),
        ]
    )
    db_session.commit()

    result = sync_libro_mayor_periodo(
        db_session,
        "202608",
        source_rows=[_libro_mayor_row(3, 2026, 8)],
    )
    stored = db_session.exec(
        select(ErpLibroMayor).order_by(ErpLibroMayor.periodo_mes)
    ).all()

    assert result == {
        "periodo": "2026-08",
        "rows_read": 1,
        "rows_deleted": 1,
        "rows_inserted": 1,
    }
    assert [(row.source_id, row.periodo_mes) for row in stored] == [(2, 7), (3, 8)]


def test_source_query_uses_same_business_filters_as_libro_diario():
    assert "lm.nivel = 'subcuenta'" in SOURCE_QUERY
    assert "lm.empresa_id NOT IN (3, 4)" in SOURCE_QUERY
    assert "btrim(lm.centro_costo) = ANY(%s)" in SOURCE_QUERY
    assert "JOIN public.dim_cuenta" in SOURCE_QUERY
    assert "01 - OBRAS" in SOURCE_QUERY
    assert "left(btrim(dc.extendido), 1) IN ('4', '5')" in SOURCE_QUERY


@pytest.mark.parametrize("empty", [False, True])
def test_range_marks_complete_import_even_without_project_centers(db_session, monkeypatch, empty):
    connection = MagicMock()
    cursor = connection.__enter__.return_value.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [] if empty else [_libro_mayor_row(8, 2026, 10)]
    monkeypatch.setattr(libro_mayor_sync.psycopg, "connect", lambda **_: connection)
    monkeypatch.setattr(libro_mayor_sync, "get_source_connection_kwargs", lambda: {})

    result = libro_mayor_sync.sync_libro_mayor_rango(db_session, "2026-10", "2026-10")

    cursor.execute.assert_called_once_with(SOURCE_QUERY, ([], 2026, 10, []))
    assert result["rows_inserted"] == (0 if empty else 1)
    period = db_session.exec(select(ErpCashPeriodo)).one()
    assert period.mayor_cash_importado is True
    assert period.diario_cash_importado is False


def test_bulk_insert_keeps_nullable_rows_in_one_batch(db_session):
    rows = [_libro_mayor_row(i, 2026, 10) for i in range(1, 5)]
    rows[1]["centro_costo"] = "100"
    rows[3]["centro_costo"] = "200"
    inserts = []

    def capture(_conn, _cursor, statement, _parameters, _context, executemany):
        if statement.startswith("INSERT INTO erp_libro_mayor "):
            inserts.append(executemany)

    bind = db_session.get_bind()
    event.listen(bind, "before_cursor_execute", capture)
    try:
        sync_libro_mayor_periodo(db_session, "2026-10", source_rows=rows)
    finally:
        event.remove(bind, "before_cursor_execute", capture)
    assert inserts == [True]
    stored = db_session.exec(select(ErpLibroMayor).order_by(ErpLibroMayor.source_id)).all()
    assert [row.centro_costo for row in stored] == [None, "100", None, "200"]
    assert db_session.exec(select(ErpCashPeriodo)).first() is None


def test_importacion_completa_vacia_registra_disponibilidad_local(db_session,monkeypatch):
    from app.models.erp.cash_periodo import ErpCashPeriodo
    monkeypatch.setattr("app.models.erp.libro_mayor_sync.fetch_libro_mayor_source_rows",lambda *args: [])
    result=sync_libro_mayor_periodo(db_session,"2026-10",allowed_centros=[])
    period=db_session.exec(select(ErpCashPeriodo)).one()
    assert result["rows_inserted"] == 0
    assert period.mayor_cash_importado is True
    assert period.diario_cash_importado is False


def test_endpoint_sync_libro_mayor_usa_periodo_y_devuelve_resultado(
    db_session,
    monkeypatch,
):
    expected = {
        "periodo": "2026-08",
        "rows_read": 10,
        "rows_deleted": 8,
        "rows_inserted": 10,
    }
    captured = {}

    def fake_sync(session, periodo):
        captured["session"] = session
        captured["periodo"] = periodo
        return expected

    monkeypatch.setattr(
        erp_libro_mayor_router,
        "sync_libro_mayor_periodo",
        fake_sync,
    )

    result = erp_libro_mayor_router.sync_erp_libro_mayor(
        {"periodo": "2026-08"},
        db_session,
    )

    assert result == expected
    assert captured == {"session": db_session, "periodo": "2026-08"}


def test_sync_libro_mayor_cerrado_conserva_datos_antes_de_consultar_erp(db_session, monkeypatch):
    row = ErpLibroMayor(**_libro_mayor_row(10, 2026, 8))
    period = ErpCashPeriodo(fecha_periodo=date(2026, 8, 1), estado="CERRADO", mayor_cash_importado=True)
    db_session.add_all([row, period])
    db_session.commit()
    monkeypatch.setattr(libro_mayor_sync, "fetch_libro_mayor_source_rows", lambda *args: pytest.fail("No debe consultar ERP"))
    for source_rows in (None, []):
        with pytest.raises(ValueError, match="debe reabrirse"):
            sync_libro_mayor_periodo(db_session, "2026-08", source_rows=source_rows)
        assert db_session.exec(select(ErpLibroMayor)).one().source_id == 10
    db_session.refresh(period)
    assert period.mayor_cash_importado is True
    period.estado = "EN_CIERRE"
    db_session.add(period)
    db_session.commit()
    result = sync_libro_mayor_periodo(db_session, "2026-08", source_rows=[])
    assert result["rows_deleted"] == 1
