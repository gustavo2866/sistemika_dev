from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import (
    FuncionProyeccion,
    MetodoProyeccion,
    MetodoProyeccionCuenta,
    MetodoProyeccionDetalle,
)
from app.services.cash_projection_service import (
    ProjectionConfigurationError,
    ProjectionDataError,
    calculate_cash_projection,
    project_cash_account_range,
)


def _create_method(
    session: Session,
    *,
    target_month: int,
    from_offset: int,
    to_offset: int,
    function: FuncionProyeccion = FuncionProyeccion.ULTIMO,
    factor: Decimal = Decimal("1"),
) -> tuple[MetodoProyeccion, ErpCashCuenta]:
    method = MetodoProyeccion(nombre=f"Metodo {target_month}", activo=True)
    session.add(method)
    session.flush()
    rule = MetodoProyeccionDetalle(
        id_metodo_proyeccion=method.id,
        mes_destino=target_month,
        mes_base_desde=from_offset,
        mes_base_hasta=to_offset,
        funcion=function,
        factor=factor,
    )
    account = ErpCashCuenta(
        descripcion=f"Cuenta {target_month}",
        tipo="Ingreso",
        id_metodo_proyeccion=method.id,
    )
    session.add(rule)
    session.add(account)
    session.flush()
    return method, account


def _add_real(
    session: Session,
    *,
    source_id: int,
    month: date,
    erp_account: int,
    cash_account_id: int,
    value: Decimal,
) -> None:
    session.add(
        ErpCashDiario(
            source_id=source_id,
            empresa_id=1,
            fecha=month,
            periodo_anio=month.year,
            periodo_mes=month.month,
            cuenta_codigo=erp_account,
            cuenta_cash_id=cash_account_id,
            debe=-value,
            haber=Decimal("0"),
        )
    )


def test_calcula_mes_combinando_real_erp_cerrado_y_proyectado_abierto(db_session: Session):
    method, account = _create_method(
        db_session,
        target_month=4,
        from_offset=-2,
        to_offset=-1,
        function=FuncionProyeccion.SUMA,
        factor=Decimal("1.5"),
    )
    db_session.add_all(
        [
            MetodoProyeccionCuenta(
                id_metodo_proyeccion=method.id,
                nro_cuenta=410101,
                activo=True,
            ),
            MetodoProyeccionCuenta(
                id_metodo_proyeccion=method.id,
                nro_cuenta=410102,
                activo=True,
            ),
            ErpCashPeriodo(fecha_periodo=date(2026, 2, 1), estado="CERRADO"),
            ErpCashPeriodo(fecha_periodo=date(2026, 3, 1), estado="ABIERTO"),
            ErpCashProyectado(
                cuenta_cash_id=account.id,
                fecha_periodo=date(2026, 3, 1),
                tipo="PROYECCION",
                importe=Decimal("50"),
            ),
        ]
    )
    _add_real(
        db_session,
        source_id=1,
        month=date(2026, 2, 10),
        erp_account=410101,
        cash_account_id=account.id,
        value=Decimal("100"),
    )
    _add_real(
        db_session,
        source_id=2,
        month=date(2026, 2, 15),
        erp_account=410102,
        cash_account_id=999,
        value=Decimal("200"),
    )
    _add_real(
        db_session,
        source_id=3,
        month=date(2026, 2, 20),
        erp_account=999999,
        cash_account_id=account.id,
        value=Decimal("900"),
    )
    db_session.commit()

    result = calculate_cash_projection(
        db_session,
        cash_account_id=account.id,
        target_month=date(2026, 4, 20),
    )

    assert result.base_value == Decimal("350")
    assert result.projected_value == Decimal("525.00")
    assert [(item.month, item.source, item.value) for item in result.base_values] == [
        (date(2026, 2, 1), "REAL_CUENTAS_ERP", Decimal("300")),
        (date(2026, 3, 1), "PROYECTADO_EXISTENTE", Decimal("50")),
    ]


def test_sin_cuentas_erp_usa_real_de_la_misma_cuenta_cash(db_session: Session):
    _, account = _create_method(
        db_session,
        target_month=9,
        from_offset=-1,
        to_offset=-1,
    )
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, 8, 1), estado="CERRADO"))
    _add_real(
        db_session,
        source_id=10,
        month=date(2026, 8, 5),
        erp_account=100,
        cash_account_id=account.id,
        value=Decimal("125.25"),
    )
    _add_real(
        db_session,
        source_id=11,
        month=date(2026, 8, 5),
        erp_account=100,
        cash_account_id=999,
        value=Decimal("999"),
    )
    db_session.commit()

    result = calculate_cash_projection(
        db_session,
        cash_account_id=account.id,
        target_month=date(2026, 9, 1),
    )

    assert result.projected_value == Decimal("125.25")
    assert result.base_values[0].source == "REAL_CUENTA_CASH"


def test_periodo_no_cerrado_sin_proyeccion_informa_dato_faltante(db_session: Session):
    _, account = _create_method(
        db_session,
        target_month=9,
        from_offset=-1,
        to_offset=-1,
    )
    db_session.commit()

    with pytest.raises(ProjectionDataError, match="No existe una proyeccion") as exc_info:
        calculate_cash_projection(
            db_session,
            cash_account_id=account.id,
            target_month=date(2026, 9, 1),
        )

    assert exc_info.value.cash_account_id == account.id
    assert exc_info.value.missing_month == date(2026, 8, 1)
    assert exc_info.value.reason == "MISSING_PROJECTION"


def test_rechaza_mes_base_actual_o_futuro_para_evitar_ciclos(db_session: Session):
    _, account = _create_method(
        db_session,
        target_month=9,
        from_offset=0,
        to_offset=0,
    )
    db_session.commit()

    with pytest.raises(ProjectionConfigurationError, match="dependencias circulares"):
        calculate_cash_projection(
            db_session,
            cash_account_id=account.id,
            target_month=date(2026, 9, 1),
        )


@pytest.mark.parametrize(
    ("function", "expected"),
    [
        (FuncionProyeccion.ULTIMO, Decimal("300.00")),
        (FuncionProyeccion.PROMEDIO, Decimal("200.00")),
        (FuncionProyeccion.SUMA, Decimal("400.00")),
        (FuncionProyeccion.MAX, Decimal("300.00")),
        (FuncionProyeccion.MIN, Decimal("100.00")),
    ],
)
def test_aplica_funcion_configurada(
    db_session: Session,
    function: FuncionProyeccion,
    expected: Decimal,
):
    _, account = _create_method(
        db_session,
        target_month=5,
        from_offset=-2,
        to_offset=-1,
        function=function,
    )
    db_session.add_all(
        [
            ErpCashPeriodo(fecha_periodo=date(2026, 3, 1), estado="CERRADO"),
            ErpCashPeriodo(fecha_periodo=date(2026, 4, 1), estado="CERRADO"),
        ]
    )
    _add_real(
        db_session,
        source_id=20,
        month=date(2026, 3, 5),
        erp_account=100,
        cash_account_id=account.id,
        value=Decimal("100"),
    )
    _add_real(
        db_session,
        source_id=21,
        month=date(2026, 4, 5),
        erp_account=100,
        cash_account_id=account.id,
        value=Decimal("300"),
    )
    db_session.commit()

    result = calculate_cash_projection(
        db_session,
        cash_account_id=account.id,
        target_month=date(2026, 5, 1),
    )

    assert result.projected_value == expected


def test_proyecta_rango_en_orden_y_reutiliza_resultados_sin_persistir(db_session: Session):
    method, account = _create_method(
        db_session,
        target_month=9,
        from_offset=-1,
        to_offset=-1,
    )
    db_session.add_all(
        [
            MetodoProyeccionDetalle(
                id_metodo_proyeccion=method.id,
                mes_destino=10,
                mes_base_desde=-1,
                mes_base_hasta=-1,
                funcion=FuncionProyeccion.ULTIMO,
                factor=Decimal("1"),
            ),
            MetodoProyeccionDetalle(
                id_metodo_proyeccion=method.id,
                mes_destino=11,
                mes_base_desde=-1,
                mes_base_hasta=-1,
                funcion=FuncionProyeccion.ULTIMO,
                factor=Decimal("1"),
            ),
            ErpCashPeriodo(fecha_periodo=date(2026, 8, 1), estado="CERRADO"),
            ErpCashProyectado(
                cuenta_cash_id=account.id,
                fecha_periodo=date(2026, 9, 1),
                tipo="PROYECCION",
                importe=Decimal("999"),
            ),
        ]
    )
    _add_real(
        db_session,
        source_id=30,
        month=date(2026, 8, 5),
        erp_account=100,
        cash_account_id=account.id,
        value=Decimal("100"),
    )
    db_session.commit()

    results = project_cash_account_range(
        db_session,
        cash_account_id=account.id,
        period_from=date(2026, 9, 20),
        period_to=date(2026, 11, 30),
    )

    assert [item.target_month for item in results] == [
        date(2026, 9, 1),
        date(2026, 10, 1),
        date(2026, 11, 1),
    ]
    assert [item.projected_value for item in results] == [
        Decimal("100.00"),
        Decimal("100.00"),
        Decimal("100.00"),
    ]
    assert results[1].base_values[0].source == "PROYECTADO_CALCULADO"
    assert results[1].base_values[0].value == Decimal("100.00")
    assert results[0].projection_method_name == method.nombre
    assert results[0].base_month_from == -1
    assert results[0].base_month_to == -1
    assert results[0].erp_account_numbers == ()

    stored_rows = db_session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.cuenta_cash_id == account.id,
            ErpCashProyectado.deleted_at.is_(None),
        )
    ).all()
    assert len(stored_rows) == 1
    assert stored_rows[0].importe == Decimal("999")


def test_proyectar_rango_rechaza_periodos_invertidos(db_session: Session):
    with pytest.raises(ProjectionConfigurationError, match="periodo desde"):
        project_cash_account_range(
            db_session,
            cash_account_id=1,
            period_from=date(2026, 10, 1),
            period_to=date(2026, 9, 1),
        )
