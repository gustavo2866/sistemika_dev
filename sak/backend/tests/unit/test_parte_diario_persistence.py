from sqlalchemy import UniqueConstraint
from sqlmodel import select

from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import ParteDiario, ParteDiarioDetalle
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


def test_seed_parte_diario_estados_is_idempotent(db_session) -> None:
    assert seed_parte_diario_estados(db_session) == len(DEFAULT_PARTE_DIARIO_ESTADOS)
    assert seed_parte_diario_estados(db_session) == 0

    rows = db_session.exec(select(ParteDiarioEstado)).all()

    assert len(rows) == len(DEFAULT_PARTE_DIARIO_ESTADOS)


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
