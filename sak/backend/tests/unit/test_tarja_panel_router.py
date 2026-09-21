from datetime import date
from decimal import Decimal

from app.models import Proyecto, User
from app.models.tarja import Tarja, TarjaNomina
from app.routers.tarja_router import get_tarja_panel
from app.services.parte_diario_tarja_service import parte_diario_tarja_service


def test_tarja_panel_incluye_premio_definido_en_la_tarja(db_session):
    user = User(nombre="Tester", email="tarja-panel-premio@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(
        nombre="Obra con premio",
        responsable_id=user.id,
        estado="02-ejecucion",
    )
    db_session.add(proyecto)
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
        premio=Decimal("1250.50"),
    )
    db_session.add(tarja)
    db_session.flush()
    registro_nomina = TarjaNomina(
        tarja_id=tarja.id,
        adicional_importe=Decimal("200"),
        premio=True,
        premio_importe=Decimal("900"),
        fecha_desde=tarja.fechainicio,
        fecha_hasta=tarja.fechafinal,
    )
    db_session.add(registro_nomina)
    db_session.commit()

    panel = get_tarja_panel(
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
        idproyecto=proyecto.id,
        estado="02-ejecucion",
        session=db_session,
    )

    assert len(panel["rows"]) == 1
    panel_tarja = panel["rows"][0]["tarja"]
    assert panel_tarja["adicional"] == 200
    assert panel_tarja["premio_tarja"] == 1250.5
    assert panel_tarja["viaticos"] is False
    assert "premio" not in panel_tarja


def test_tarja_generada_toma_viaticos_por_defecto_segun_la_obra(db_session):
    user = User(nombre="Tester", email="tarja-panel-viaticos@example.com")
    db_session.add(user)
    db_session.flush()
    san_pablo = Proyecto(
        nombre="SP SRL - Solana Yerba s/n - San Pablo",
        responsable_id=user.id,
        estado="02-ejecucion",
    )
    otra_obra = Proyecto(
        nombre="Francia 118",
        responsable_id=user.id,
        estado="02-ejecucion",
    )
    db_session.add_all([san_pablo, otra_obra])
    db_session.flush()

    tarja_san_pablo, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=int(san_pablo.id),
        contacto_id=None,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )
    tarja_otra_obra, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=int(otra_obra.id),
        contacto_id=None,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )

    assert tarja_san_pablo.viaticos is True
    assert tarja_otra_obra.viaticos is False
