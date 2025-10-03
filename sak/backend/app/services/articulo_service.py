from decimal import Decimal
from sqlalchemy.orm import Session
from sqlmodel import select

from app.models.articulo import Articulo, DEFAULT_ARTICULOS


def seed_articulos(session: Session) -> None:
    for nombre, tipo, unidad, marca, sku, precio, proveedor_id in DEFAULT_ARTICULOS:
        articulo = session.exec(select(Articulo).where(Articulo.nombre == nombre)).first()
        if articulo:
            continue
        session.add(
            Articulo(
                nombre=nombre,
                tipo_articulo=tipo,
                unidad_medida=unidad,
                marca=marca,
                sku=sku,
                precio=Decimal(str(precio)),
                proveedor_id=proveedor_id,
            )
        )
    session.commit()
