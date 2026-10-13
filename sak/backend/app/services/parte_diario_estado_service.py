from dataclasses import dataclass

from sqlmodel import Session, select

from app.models.parte_diario_estado import ParteDiarioEstado


@dataclass(frozen=True)
class ParteDiarioEstadoSeed:
    abreviatura: str
    nombre: str
    licencia: bool = False


DEFAULT_PARTE_DIARIO_ESTADOS = (
    ParteDiarioEstadoSeed("P", "PRESENTE", licencia=False),
    ParteDiarioEstadoSeed("ENF", "ENFERMEDAD", licencia=True),
    ParteDiarioEstadoSeed("ACC", "ACCIDENTE", licencia=True),
    ParteDiarioEstadoSeed("FAL", "FALTA", licencia=False),
    ParteDiarioEstadoSeed("VAC", "VACACIONES", licencia=True),
    ParteDiarioEstadoSeed("FER", "FERIADO", licencia=False),
    ParteDiarioEstadoSeed("PER", "PERMISO", licencia=False),
    ParteDiarioEstadoSeed("LLV", "LLUVIA", licencia=False),
    ParteDiarioEstadoSeed("BAJ", "BAJA", licencia=False),
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
                justifica=False,
                licencia=item.licencia,
            )
        )
        inserted += 1

    if inserted:
        session.commit()

    return inserted
