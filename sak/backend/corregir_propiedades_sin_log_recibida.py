#!/usr/bin/env python3
"""
Corrección: insertar log inicial 'Recibida' en propiedades que no lo tienen.
Identificadas por diagnostico_propiedades_sin_log_recibida.py
"""

import sys
sys.path.insert(0, '.')

from datetime import UTC, datetime
from sqlmodel import Session, select

from app.db import get_session
from app.models.propiedad import Propiedad, PropiedadesLogStatus, PropiedadesStatus


IDS_A_CORREGIR = [79, 86, 134, 139, 140, 141, 142, 143]


def corregir():
    print("=== CORRECCIÓN: LOG INICIAL 'RECIBIDA' FALTANTE ===")
    print()

    session: Session = next(get_session())

    # Obtener estado "Recibida"
    recibida = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.es_inicial == True)  # noqa: E712
    ).first()
    if not recibida:
        recibida = session.exec(
            select(PropiedadesStatus).where(PropiedadesStatus.orden == 1)
        ).first()
    if not recibida:
        print("❌ Estado inicial 'Recibida' no encontrado. Abortando.")
        return

    print(f"Estado inicial: ID={recibida.id}, nombre='{recibida.nombre}'")
    print()

    corregidas = []
    omitidas = []

    for prop_id in IDS_A_CORREGIR:
        prop = session.get(Propiedad, prop_id)
        if not prop:
            print(f"  [{prop_id}] ❌ No encontrada — omitida")
            omitidas.append(prop_id)
            continue

        # Verificar que realmente no tenga ya el log inicial
        log_existente = session.exec(
            select(PropiedadesLogStatus)
            .where(PropiedadesLogStatus.propiedad_id == prop_id)
            .where(PropiedadesLogStatus.estado_anterior_id == None)  # noqa: E711
            .where(PropiedadesLogStatus.estado_nuevo_id == recibida.id)
        ).first()

        if log_existente:
            print(f"  [{prop_id}] ⚠️  '{prop.nombre}' — ya tiene log inicial, omitida")
            omitidas.append(prop_id)
            continue

        # Usar created_at de la propiedad como fecha del log inicial
        fecha_cambio = prop.created_at
        if fecha_cambio and fecha_cambio.tzinfo is None:
            fecha_cambio = fecha_cambio.replace(tzinfo=UTC)
        if not fecha_cambio:
            fecha_cambio = datetime.now(UTC)

        log = PropiedadesLogStatus(
            propiedad_id=prop_id,
            estado_anterior_id=None,
            estado_nuevo_id=recibida.id,
            estado_anterior=None,
            estado_nuevo=recibida.nombre,
            fecha_cambio=fecha_cambio,
            usuario_id=1,
            motivo="Log inicial agregado por corrección automática",
            observaciones=None,
        )
        session.add(log)
        corregidas.append((prop_id, prop.nombre))
        print(f"  [{prop_id}] ✅ '{prop.nombre}' — log inicial agregado (fecha: {fecha_cambio.date()})")

    if corregidas:
        session.commit()
        print()
        print(f"✅ Corrección completada: {len(corregidas)} propiedad(es) actualizadas.")
        print(f"   IDs corregidos: {[pid for pid, _ in corregidas]}")
    else:
        print()
        print("No se realizaron cambios.")

    if omitidas:
        print(f"   Omitidas: {omitidas}")


if __name__ == "__main__":
    corregir()
