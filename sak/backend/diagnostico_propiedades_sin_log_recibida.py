#!/usr/bin/env python3
"""
Diagnóstico: propiedades que no tienen el log inicial "Recibida".
Solo lectura — no modifica nada.
"""

import sys
sys.path.insert(0, '.')

from sqlmodel import Session, select
from sqlalchemy import not_, exists

from app.db import get_session
from app.models.propiedad import Propiedad, PropiedadesLogStatus, PropiedadesStatus


def diagnosticar():
    print("=== DIAGNÓSTICO: PROPIEDADES SIN LOG INICIAL 'RECIBIDA' ===")
    print()

    session: Session = next(get_session())

    # Obtener el estado "Recibida" (es_inicial=True, orden=1)
    recibida = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.es_inicial == True)  # noqa: E712
    ).first()

    if not recibida:
        recibida = session.exec(
            select(PropiedadesStatus).where(PropiedadesStatus.orden == 1)
        ).first()

    if not recibida:
        print("❌ No se encontró el estado inicial 'Recibida' en propiedades_status.")
        return

    print(f"Estado inicial encontrado: ID={recibida.id}, nombre='{recibida.nombre}'")
    print()

    # Propiedades que NO tienen ningún log con estado_anterior_id IS NULL
    # (es decir, nunca se les registró el estado inicial)
    subq_tiene_log_inicial = (
        select(PropiedadesLogStatus.propiedad_id)
        .where(PropiedadesLogStatus.estado_anterior_id == None)  # noqa: E711
        .where(PropiedadesLogStatus.estado_nuevo_id == recibida.id)
    )

    propiedades_sin_log = session.exec(
        select(Propiedad)
        .where(not_(Propiedad.id.in_(subq_tiene_log_inicial)))
        .order_by(Propiedad.id.asc())
    ).all()

    if not propiedades_sin_log:
        print("✅ Todas las propiedades tienen su log inicial 'Recibida'.")
        return

    print(f"⚠️  Propiedades sin log inicial 'Recibida': {len(propiedades_sin_log)}")
    print()
    print(f"{'ID':>5}  {'Nombre':<40}  {'Estado actual':<20}  {'Creada'}")
    print("-" * 90)

    ids_afectados = []
    for prop in propiedades_sin_log:
        estado_actual = prop.propiedad_status.nombre if prop.propiedad_status else "Sin estado"
        creada = prop.created_at.strftime("%Y-%m-%d") if prop.created_at else "?"
        print(f"{prop.id:>5}  {str(prop.nombre or ''):<40}  {estado_actual:<20}  {creada}")
        ids_afectados.append(prop.id)

    print()
    print(f"IDs para corrección: {ids_afectados}")

    # Detalle extra: cuántas tienen logs (pero no el inicial)
    con_otros_logs = []
    sin_ningun_log = []
    for prop in propiedades_sin_log:
        logs = session.exec(
            select(PropiedadesLogStatus)
            .where(PropiedadesLogStatus.propiedad_id == prop.id)
        ).all()
        if logs:
            con_otros_logs.append(prop.id)
        else:
            sin_ningun_log.append(prop.id)

    print()
    if sin_ningun_log:
        print(f"  Sin ningún log:            {sin_ningun_log}")
    if con_otros_logs:
        print(f"  Con logs pero no 'Recibida': {con_otros_logs}")


if __name__ == "__main__":
    diagnosticar()
