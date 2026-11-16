from datetime import date, datetime, timezone
from decimal import Decimal

from app.models.erp.cuenta import ErpCuenta
from app.models.erp.indice import ErpIndice
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.rubro import ErpRubro
from app.models.proyecto import Proyecto
from app.models.user import User
from app.services.erp_libro_mayor_panel_service import get_libro_mayor_reales_panel


def test_panel_reales_agrupa_historico_y_actual_por_anio(db_session):
    user = User(nombre="Panel Reales", email="panel@reales.test")
    rubro = ErpRubro(nombre="Materiales", activo=True)
    income_rubro = ErpRubro(nombre="Ingresos", activo=True)
    db_session.add(user)
    db_session.add(rubro)
    db_session.add(income_rubro)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(rubro)
    db_session.refresh(income_rubro)

    project = Proyecto(
        nombre="Obra Panel",
        estado="02-ejecucion",
        centro_costo=101,
        responsable_id=user.id,
    )
    account = ErpCuenta(
        rubro_id=rubro.id,
        nro_cuenta=5101,
        cod_cuenta="5.01",
        descripcion="Materiales",
    )
    income_account = ErpCuenta(
        rubro_id=income_rubro.id,
        nro_cuenta=4101,
        cod_cuenta="4.01",
        descripcion="Ingresos",
    )
    db_session.add(project)
    db_session.add(account)
    db_session.add(income_account)
    db_session.add_all(
        [
            ErpIndice(
                codigo="ICC",
                fecha=date(2023, 12, 1),
                valor=Decimal("100"),
            ),
            ErpIndice(
                codigo="ICC",
                fecha=date.today().replace(day=1),
                valor=Decimal("200"),
            ),
        ]
    )
    db_session.commit()

    db_session.add_all(
        [
            ErpLibroMayor(
                source_id=91001,
                empresa_id=1,
                periodo_anio=2024,
                periodo_mes=1,
                nivel="subcuenta",
                cuenta_codigo=5101,
                centro_costo="101",
                total_debe=Decimal("100"),
                total_haber=Decimal("-20"),
                total_debe_actualizado=Decimal("150"),
                total_haber_actualizado=Decimal("-30"),
                saldo_periodo=Decimal("80"),
                saldo_acumulado=Decimal("1080"),
                saldo_anterior=Decimal("1000"),
                recalculado_en=datetime.now(timezone.utc),
                fecha_periodo=date(2024, 1, 1),
            ),
            ErpLibroMayor(
                source_id=91002,
                empresa_id=1,
                periodo_anio=2025,
                periodo_mes=1,
                nivel="subcuenta",
                cuenta_codigo=5101,
                centro_costo="101",
                total_debe=Decimal("200"),
                total_haber=Decimal("0"),
                total_debe_actualizado=Decimal("240"),
                total_haber_actualizado=Decimal("0"),
                saldo_periodo=Decimal("0"),
                saldo_acumulado=Decimal("0"),
                saldo_anterior=Decimal("0"),
                recalculado_en=datetime.now(timezone.utc),
                fecha_periodo=date(2025, 1, 1),
            ),
            ErpLibroMayor(
                source_id=91003,
                empresa_id=1,
                periodo_anio=2024,
                periodo_mes=1,
                nivel="subcuenta",
                cuenta_codigo=4101,
                centro_costo="101",
                total_debe=Decimal("0"),
                total_haber=Decimal("-500"),
                total_debe_actualizado=Decimal("0"),
                total_haber_actualizado=Decimal("-600"),
                saldo_periodo=Decimal("-500"),
                saldo_acumulado=Decimal("-2500"),
                saldo_anterior=Decimal("-2000"),
                recalculado_en=datetime.now(timezone.utc),
                fecha_periodo=date(2024, 1, 1),
            ),
        ]
    )
    db_session.commit()

    result = get_libro_mayor_reales_panel(
        db_session,
        anio_desde=2024,
        anio_hasta=2025,
    )

    assert result["years"] == [2024, 2025]
    assert len(result["rows"]) == 1
    project_row = result["rows"][0]
    assert project_row["saldo_inicial"] == {"historico": 1000.0, "actual": 2000.0}
    assert project_row["years"]["2024"] == {"historico": 420.0, "actual": 480.0}
    assert project_row["years"]["2025"] == {"historico": -200.0, "actual": -240.0}
    assert project_row["total"] == {"historico": 1220.0, "actual": 2240.0}

    material_row = next(
        item for item in project_row["rubros"] if item["rubro_nombre"] == "Materiales"
    )
    assert material_row["saldo_inicial"] == {"historico": -1000.0, "actual": -2000.0}
    assert material_row["years"]["2024"] == {"historico": -80.0, "actual": -120.0}
    assert material_row["cuentas"][0]["cuenta_codigo"] == "5.01"
    assert material_row["cuentas"][0]["cuenta_numero"] == 5101
