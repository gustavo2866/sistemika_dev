"""Bootstrap & seed script for PostgreSQL database `sak_backend`.

Usage (PowerShell):

  # Asegúrate de que el entorno (.env) tiene DATABASE_URL apuntando a sak_backend
  # Ejemplo: DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak_backend

  python scripts/seed_sak_backend.py

El script es idempotente: sólo crea registros si no existen.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal

# Agregar el directorio backend al path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Cargar variables de entorno desde .env
from dotenv import load_dotenv
load_dotenv(BACKEND_ROOT / ".env")

from sqlmodel import Session, select

from app.db import engine  # Usa DATABASE_URL desde .env
from app.models.user import User
from app.models.articulo import Articulo, DEFAULT_ARTICULOS
from app.models.solicitud import Solicitud, TipoSolicitud
from app.models.solicitud_detalle import SolicitudDetalle


def get_or_create_user(session: Session) -> User:
    user = session.exec(select(User).where(User.email == "demo@example.com")).first()
    if user:
        return user
    user = User(
        nombre="Usuario Demo2",
        telefono="+54 11 5555-0000",
        email="demo@example.com",
        url_foto=None,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    print(f"✔ Usuario creado id={user.id}")
    return user


def seed_articulos(session: Session) -> list[Articulo]:
    existing = session.exec(select(Articulo)).all()
    if existing:
        print(f"✔ Articulos existentes: {len(existing)} (no se recrean)")
        return existing
    articulos: list[Articulo] = []
    for nombre, tipo_articulo, unidad, marca, sku, precio, proveedor_id in DEFAULT_ARTICULOS[:10]:  # semilla parcial
        art = Articulo(
            nombre=nombre,
            tipo_articulo=tipo_articulo,
            unidad_medida=unidad,
            marca=marca,
            sku=sku,
            precio=Decimal(str(precio)),
            proveedor_id=None,  # Sin proveedor por ahora (evita FK constraint)
        )
        session.add(art)
        articulos.append(art)
    session.commit()
    for a in articulos:
        session.refresh(a)
    print(f"✔ {len(articulos)} articulos sembrados")
    return articulos


def seed_solicitud(session: Session, user: User, articulos: list[Articulo]) -> Solicitud:
    # Crear sólo si no existe una solicitud demo
    sol = session.exec(
        select(Solicitud).where(Solicitud.comentario == "Solicitud inicial de prueba")
    ).first()
    if sol:
        print(f"✔ Solicitud demo existente id={sol.id}")
        return sol
    sol = Solicitud(
        tipo=TipoSolicitud.NORMAL,
        fecha_necesidad=date.today() + timedelta(days=7),
        comentario="Solicitud inicial de prueba",
        solicitante_id=user.id,
    )
    session.add(sol)
    session.commit()
    session.refresh(sol)
    print(f"✔ Solicitud creada id={sol.id}")

    # Crear algunos detalles
    detalles_data = [
        dict(descripcion="Bolsa de cemento x 50kg", unidad_medida="bolsa", cantidad=Decimal("5"), articulo_id=articulos[0].id),
        dict(descripcion="Arena fina", unidad_medida="m3", cantidad=Decimal("2.5"), articulo_id=articulos[1].id),
        dict(descripcion="Hierro 8mm", unidad_medida="barra", cantidad=Decimal("12"), articulo_id=articulos[6].id),
    ]
    for d in detalles_data:
        det = SolicitudDetalle(solicitud_id=sol.id, **d)
        session.add(det)
    session.commit()
    print(f"✔ {len(detalles_data)} detalles creados para solicitud {sol.id}")
    return sol


def main() -> None:
    db_url = os.getenv("DATABASE_URL")
    print(f"→ Usando DATABASE_URL = {db_url}")
    with Session(engine) as session:
        user = get_or_create_user(session)
        articulos = seed_articulos(session)
        seed_solicitud(session, user, articulos)
    print("✅ Seed completado")


if __name__ == "__main__":  # pragma: no cover
    main()
