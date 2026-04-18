from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Optional

from sqlmodel import Session, select

from app.models.propiedad import Propiedad, PropiedadesLogStatus, PropiedadesStatus


def sync_propiedad_status(
    session: Session,
    *,
    propiedad: Propiedad,
    estado_orden: int,
    fecha_cambio: Optional[date] = None,
    usuario_id: Optional[int] = None,
    motivo: Optional[str] = None,
) -> bool:
    if fecha_cambio is None:
        fecha_cambio = date.today()

    estado_nuevo = session.exec(
        select(PropiedadesStatus)
        .where(PropiedadesStatus.orden == estado_orden)
        .order_by(PropiedadesStatus.id.asc())
    ).first()
    if not estado_nuevo:
        return False

    prev_status_id = propiedad.propiedad_status_id

    propiedad.propiedad_status_id = estado_nuevo.id
    propiedad.estado_fecha = fecha_cambio
    propiedad.actualizar_campos_vacancia(estado_nuevo.orden, fecha_cambio)
    propiedad.updated_at = datetime.now(UTC)
    session.add(propiedad)

    if prev_status_id == estado_nuevo.id:
        return True

    estado_anterior = session.get(PropiedadesStatus, prev_status_id) if prev_status_id else None
    motivo_normalizado = motivo.strip() if isinstance(motivo, str) and motivo.strip() else None
    motivo_corto = motivo_normalizado[:200] if motivo_normalizado else None

    log = PropiedadesLogStatus(
        propiedad_id=propiedad.id,
        estado_anterior_id=prev_status_id,
        estado_nuevo_id=estado_nuevo.id,
        estado_anterior=estado_anterior.nombre if estado_anterior else None,
        estado_nuevo=estado_nuevo.nombre,
        fecha_cambio=datetime(
            fecha_cambio.year,
            fecha_cambio.month,
            fecha_cambio.day,
            tzinfo=UTC,
        ),
        usuario_id=usuario_id or 1,
        motivo=motivo_corto,
        observaciones=motivo_normalizado,
    )
    session.add(log)
    return True
