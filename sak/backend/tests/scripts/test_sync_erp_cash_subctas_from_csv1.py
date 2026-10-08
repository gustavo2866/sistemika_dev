from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine, select

from app.models.erp.cash_subcta import ErpCashSubcta
from scripts.sync_erp_cash_subctas_from_csv1 import (
    CashSubctaSeed,
    apply_sync_plan,
    build_sync_plan,
    load_source_rows,
    verify_active_rows,
)


@pytest.fixture()
def db_session() -> Iterator[Session]:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ErpCashSubcta.__table__.create(test_engine)
    with Session(test_engine) as session:
        yield session
    ErpCashSubcta.__table__.drop(test_engine)


def test_load_source_rows_detecta_columnas_invertidas_y_cp1252(tmp_path):
    source = tmp_path / "subctas.csv"
    source.write_text(
        "tpo_subcta;descripcion;nro_subcta;categoria\n"
        "2;8;CORRALON ACONQUIJA S.R.L;Obras\n"
        "1;4012;DESIMA ADRIANA / ARGAÑARAZ;Alq Socios\n"
        ";;;\n",
        encoding="cp1252",
    )

    rows, encoding, inverted = load_source_rows(source)

    assert encoding == "cp1252"
    assert inverted is True
    assert rows == [
        CashSubctaSeed(2, 8, "CORRALON ACONQUIJA S.R.L", "Obras"),
        CashSubctaSeed(1, 4012, "DESIMA ADRIANA / ARGAÑARAZ", "Alq Socios"),
    ]


def test_plan_aplica_altas_cambios_restauraciones_y_bajas(db_session):
    unchanged = ErpCashSubcta(
        tpo_subcta=1,
        nro_subcta=10,
        descripcion="Sin cambios",
        categoria="Alq Socios",
    )
    changed = ErpCashSubcta(
        tpo_subcta=1,
        nro_subcta=20,
        descripcion="Nombre anterior",
        categoria="Anterior",
    )
    deleted = ErpCashSubcta(
        tpo_subcta=2,
        nro_subcta=30,
        descripcion="Restaurar",
        categoria="Obras",
        deleted_at=datetime.now(UTC),
    )
    extra = ErpCashSubcta(
        tpo_subcta=2,
        nro_subcta=99,
        descripcion="Sobrante",
        categoria="Obras",
    )
    db_session.add_all([unchanged, changed, deleted, extra])
    db_session.commit()

    seeds = [
        CashSubctaSeed(1, 10, "Sin cambios", "Alq Socios"),
        CashSubctaSeed(1, 20, "Nombre nuevo", "Administracion"),
        CashSubctaSeed(2, 30, "Restaurar", "Obras"),
        CashSubctaSeed(2, 40, "Nueva", "Obras"),
    ]

    plan = build_sync_plan(db_session, seeds)

    assert plan.stats() == {
        "source_rows": 4,
        "database_rows": 4,
        "rows_to_create": 1,
        "rows_to_update": 1,
        "rows_to_restore": 1,
        "rows_to_delete": 1,
        "rows_unchanged": 1,
        "rows_changed_total": 4,
    }

    apply_sync_plan(db_session, plan)
    verify_active_rows(db_session, seeds)

    rows = db_session.exec(
        select(ErpCashSubcta).order_by(
            ErpCashSubcta.tpo_subcta,
            ErpCashSubcta.nro_subcta,
        )
    ).all()
    assert [(row.tpo_subcta, row.nro_subcta) for row in rows] == [
        (1, 10),
        (1, 20),
        (2, 30),
        (2, 40),
    ]
    assert rows[1].descripcion == "Nombre nuevo"
    assert rows[1].categoria == "Administracion"
    assert rows[2].deleted_at is None
