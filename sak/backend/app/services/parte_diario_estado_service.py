from dataclasses import dataclass

from sqlmodel import Session, select

from app.models.parte_diario_estado import ParteDiarioEstado


@dataclass(frozen=True)
class ParteDiarioEstadoSeed:
    abreviatura: str
    nombre: str


DEFAULT_PARTE_DIARIO_ESTADOS = (
    ParteDiarioEstadoSeed("P", "PRESENTE"),
    ParteDiarioEstadoSeed("ENF", "ENFERMEDAD"),
    ParteDiarioEstadoSeed("ACC", "ACCIDENTE"),
    ParteDiarioEstadoSeed("FAL", "FALTA"),
    ParteDiarioEstadoSeed("VAC", "VACACIONES"),
    ParteDiarioEstadoSeed("FER", "FERIADO"),
    ParteDiarioEstadoSeed("PER", "PERMISO"),
    ParteDiarioEstadoSeed("LLV", "LLUVIA"),
    ParteDiarioEstadoSeed("BAJ", "BAJA"),
)


def seed_parte_diario_estados(session: Session) -> int:
    """Insert missing initial states without overwriting the managed catalog."""
    existing_codes = {
        code.upper()
        for code in session.exec(select(ParteDiarioEstado.abreviatura)).all()
    }
    inserted = 0

    for item in DEFAULT_PARTE_DIARIO_ESTADOS:
        if item.abreviatura in existing_codes:
            continue
        session.add(
            ParteDiarioEstado(
                abreviatura=item.abreviatura,
                nombre=item.nombre,
                activo=True,
            )
        )
        inserted += 1

    if inserted:
        session.commit()

    return inserted
