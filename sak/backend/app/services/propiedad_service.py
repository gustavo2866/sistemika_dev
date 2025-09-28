from sqlalchemy.orm import Session
from sqlmodel import select

from app.models.propiedad import DEFAULT_PROPIEDADES, Propiedad


def seed_propiedades(session: Session) -> None:
    for prop_id, nombre, tipo, propietario, estado in DEFAULT_PROPIEDADES:
        prop = session.exec(select(Propiedad).where(Propiedad.id == prop_id)).first()
        if prop:
            continue
        session.add(Propiedad(id=prop_id, nombre=nombre, tipo=tipo, propietario=propietario, estado=estado))
    session.commit()
