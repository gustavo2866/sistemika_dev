from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models.erp.indice import ErpIndice
from app.models.erp.libro_mayor import ErpLibroMayor
from app.services.erp_libro_mayor_index_service import (
    update_libro_mayor_totals_by_icc,
)


def _mayor_row(source_id: int, year: int, month: int, debe: str, haber: str):
    return ErpLibroMayor(
        source_id=source_id,
        empresa_id=1,
        periodo_anio=year,
        periodo_mes=month,
        nivel="cuenta",
        cuenta_codigo=110101,
        total_debe=Decimal(debe),
        total_haber=Decimal(haber),
        saldo_periodo=Decimal("0"),
        saldo_acumulado=Decimal("0"),
        recalculado_en=datetime(year, month, 1, tzinfo=timezone.utc),
        saldo_anterior=Decimal("0"),
        fecha_periodo=date(year, month, 1),
    )


def test_update_totals_by_icc_uses_current_period_as_target(db_session):
    db_session.add_all(
        [
            ErpIndice(codigo="ICC", fecha=date(2026, 1, 1), valor=Decimal("100")),
            ErpIndice(codigo="ICC", fecha=date(2026, 2, 1), valor=Decimal("125")),
            _mayor_row(1, 2026, 1, "100", "40"),
            _mayor_row(2, 2026, 2, "80", "20"),
        ]
    )
    db_session.commit()

    result = update_libro_mayor_totals_by_icc(
        db_session,
        periodo_destino=date(2026, 2, 20),
    )
    rows = db_session.exec(
        select(ErpLibroMayor).order_by(ErpLibroMayor.source_id)
    ).all()

    assert result["periodo_destino"] == "2026-02"
    assert result["rows_updated"] == 2
    assert rows[0].total_debe_actualizado == Decimal("125.000000")
    assert rows[0].total_haber_actualizado == Decimal("50.000000")
    assert rows[1].total_debe_actualizado == Decimal("80.000000")
    assert rows[1].total_haber_actualizado == Decimal("20.000000")


def test_update_totals_by_icc_fails_before_update_when_index_is_missing(db_session):
    db_session.add(_mayor_row(1, 2026, 1, "100", "40"))
    db_session.add(
        ErpIndice(codigo="ICC", fecha=date(2026, 2, 1), valor=Decimal("125"))
    )
    db_session.commit()

    with pytest.raises(ValueError, match="2026-01"):
        update_libro_mayor_totals_by_icc(
            db_session,
            periodo_destino=date(2026, 2, 1),
        )

    row = db_session.exec(select(ErpLibroMayor)).one()
    assert row.total_debe_actualizado is None
    assert row.total_haber_actualizado is None


def test_update_totals_by_icc_uses_latest_previous_target_index(db_session):
    db_session.add_all(
        [
            ErpIndice(codigo="ICC", fecha=date(2026, 1, 1), valor=Decimal("100")),
            ErpIndice(codigo="ICC", fecha=date(2026, 9, 1), valor=Decimal("150")),
            _mayor_row(1, 2026, 1, "100", "40"),
            _mayor_row(2, 2026, 10, "80", "20"),
        ]
    )
    db_session.commit()

    result = update_libro_mayor_totals_by_icc(
        db_session,
        periodo_destino=date(2026, 10, 1),
    )
    rows = db_session.exec(
        select(ErpLibroMayor).order_by(ErpLibroMayor.source_id)
    ).all()

    assert result["periodo_destino_solicitado"] == "2026-10"
    assert result["periodo_destino"] == "2026-09"
    assert result["periodo_destino_fallback"] is True
    assert rows[0].total_debe_actualizado == Decimal("150.000000")
    assert rows[1].total_debe_actualizado == Decimal("80.000000")


def test_update_totals_by_icc_always_starts_in_2024_01(db_session):
    db_session.add_all(
        [
            ErpIndice(codigo="ICC", fecha=date(2023, 12, 1), valor=Decimal("80")),
            ErpIndice(codigo="ICC", fecha=date(2024, 1, 1), valor=Decimal("100")),
            ErpIndice(codigo="ICC", fecha=date(2024, 2, 1), valor=Decimal("125")),
            _mayor_row(1, 2023, 12, "100", "40"),
            _mayor_row(2, 2024, 1, "100", "40"),
        ]
    )
    db_session.commit()

    result = update_libro_mayor_totals_by_icc(
        db_session,
        periodo_destino=date(2024, 2, 1),
    )
    rows = db_session.exec(
        select(ErpLibroMayor).order_by(ErpLibroMayor.source_id)
    ).all()

    assert result["periodo_desde"] == "2024-01"
    assert result["periodos_actualizados"] == 1
    assert result["rows_updated"] == 1
    assert rows[0].total_debe_actualizado is None
    assert rows[1].total_debe_actualizado == Decimal("125.000000")

