from datetime import date
from sqlalchemy.orm import Session
from sqlmodel import select

from app.models.propiedad import DEFAULT_PROPIEDADES, Propiedad


def _parse_date(value):
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def seed_propiedades(session: Session) -> None:
    for default in DEFAULT_PROPIEDADES:
        data = list(default) + [None] * 10
        (
            prop_id,
            nombre,
            tipo,
            propietario,
            estado,
            ambientes,
            metros_cuadrados,
            valor_alquiler,
            expensas,
            fecha_ingreso,
        ) = data[:10]

        prop = session.exec(select(Propiedad).where(Propiedad.id == prop_id)).first()
        if prop:
            continue
        session.add(
            Propiedad(
                id=prop_id,
                nombre=nombre,
                tipo=tipo,
                propietario=propietario,
                estado=estado,
                ambientes=ambientes,
                metros_cuadrados=metros_cuadrados,
                valor_alquiler=valor_alquiler,
                expensas=expensas,
                fecha_ingreso=_parse_date(fecha_ingreso),
            )
        )
    session.commit()
