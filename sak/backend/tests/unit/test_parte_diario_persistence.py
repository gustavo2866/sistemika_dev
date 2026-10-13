import pytest
from sqlalchemy import UniqueConstraint, inspect
from sqlmodel import select

from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import ParteDiario, ParteDiarioDetalle
from app.models import Proyecto, User
from app.routers.partediario_router import ParteDiarioCRUD
from app.services.parte_diario_estado_service import (
    DEFAULT_PARTE_DIARIO_ESTADOS,
    seed_parte_diario_estados,
)


def _unique_constraint_names(model: type) -> set[str]:
    return {
        constraint.name
        for constraint in model.__table__.constraints
        if isinstance(constraint, UniqueConstraint) and constraint.name is not None
    }


def test_parte_diario_declares_domain_unique_constraints() -> None:
    assert "uq_partes_diario_proyecto_fecha" in _unique_constraint_names(ParteDiario)
    assert (
        "uq_partes_diario_detalles_parte_nomina"
        in _unique_constraint_names(ParteDiarioDetalle)
    )


def test_generico_proyecto_relationship_uses_its_explicit_foreign_key() -> None:
    relationship = inspect(ParteDiario).relationships["generico_proyecto"]

    assert {column.key for column in relationship.local_columns} == {
        "generico_proyecto_id"
    }


def test_obra_generica_exige_proyecto_asociado(db_session) -> None:
    responsable = User(nombre="Responsable", email="generico-required@example.com")
    db_session.add(responsable)
    db_session.flush()
    obra = Proyecto(nombre="Obra generica", generico=True, responsable_id=responsable.id)
    db_session.add(obra)
    db_session.commit()

    with pytest.raises(ValueError, match="proyecto asociado es obligatorio"):
        ParteDiarioCRUD._validar_proyecto_generico(
            db_session,
            {"idproyecto": obra.id, "generico_proyecto_id": None},
        )


def test_obra_generica_admite_proyecto_activo_distinto(db_session) -> None:
    responsable = User(nombre="Responsable", email="generico-active@example.com")
    db_session.add(responsable)
    db_session.flush()
    obra = Proyecto(nombre="Obra generica", generico=True, responsable_id=responsable.id)
    asociado = Proyecto(
        nombre="Proyecto asociado",
        estado="02-ejecucion",
        responsable_id=responsable.id,
    )
    db_session.add_all([obra, asociado])
    db_session.commit()

    ParteDiarioCRUD._validar_proyecto_generico(
        db_session,
        {"idproyecto": obra.id, "generico_proyecto_id": asociado.id},
    )


def test_seed_parte_diario_estados_is_idempotent(db_session) -> None:
    assert seed_parte_diario_estados(db_session) == len(DEFAULT_PARTE_DIARIO_ESTADOS)
    assert seed_parte_diario_estados(db_session) == 0

    rows = db_session.exec(select(ParteDiarioEstado)).all()

    assert len(rows) == len(DEFAULT_PARTE_DIARIO_ESTADOS)
    assert all(row.justifica is False for row in rows)

    licencia = {
        row.abreviatura: row.licencia
        for row in rows
    }
    assert licencia["ACC"] is True
    assert licencia["ENF"] is True
    assert licencia["VAC"] is True
    assert licencia["P"] is False
    assert licencia["FAL"] is False


def test_seed_preserves_managed_catalog_values(db_session) -> None:
    seed_parte_diario_estados(db_session)
    lluvia = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "LLV")
    ).one()
    lluvia.nombre = "LLUVIA ADMINISTRADA"
    lluvia.activo = False
    db_session.add(lluvia)
    db_session.commit()

    assert seed_parte_diario_estados(db_session) == 0

    lluvia = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "LLV")
    ).one()
    assert lluvia.nombre == "LLUVIA ADMINISTRADA"
    assert lluvia.activo is False
