from __future__ import annotations

from sqlmodel import Session, select

from app.models.metodo_pago import DEFAULT_METODOS_PAGO, MetodoPago


def get_or_create_metodo_pago(session: Session, nombre: str) -> MetodoPago:
    metodo = session.exec(select(MetodoPago).where(MetodoPago.nombre == nombre)).first()
    if metodo:
        return metodo
    metodo = MetodoPago(nombre=nombre)
    session.add(metodo)
    session.commit()
    session.refresh(metodo)
    return metodo


def seed_metodos_pago(session: Session) -> None:
    for nombre in DEFAULT_METODOS_PAGO:
        get_or_create_metodo_pago(session, nombre)
