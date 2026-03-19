from __future__ import annotations

from datetime import UTC, datetime, date
from typing import Optional

from sqlmodel import Session, select
from sqlalchemy import delete, update

from app.models import (
    CRMOportunidad,
    CRMOportunidadLogEstado,
    CRMContacto,
    CRMCondicionPago,
    CRMMotivoPerdida,
    Moneda,
    Propiedad,
    CRMMensaje,
    CRMEvento,
)
from app.models.propiedad import PropiedadesLogStatus, PropiedadesStatus
from app.models.enums import (
    EstadoOportunidad,
    TRANSICIONES_ESTADO_OPORTUNIDAD,
)


class CRMOportunidadService:
    """Reglas de negocio para oportunidades CRM."""

    def _parse_fecha(self, valor: Optional[str]) -> datetime:
        if not valor:
            return datetime.now(UTC)
        if isinstance(valor, datetime):
            return valor
        try:
            if valor.endswith("Z"):
                valor = valor[:-1]
            return datetime.fromisoformat(valor)
        except ValueError:
            return datetime.now(UTC)

    def cambiar_estado(
        self,
        session: Session,
        oportunidad_id: int,
        nuevo_estado: str,
        descripcion: str,
        usuario_id: int,
        fecha_estado: Optional[str] = None,
        motivo_perdida_id: Optional[int] = None,
        monto: Optional[float] = None,
        moneda_id: Optional[int] = None,
        condicion_pago_id: Optional[int] = None,
    ) -> CRMOportunidad:
        oportunidad = session.get(CRMOportunidad, oportunidad_id)
        if not oportunidad:
            raise ValueError("Oportunidad no encontrada")

        if nuevo_estado not in TRANSICIONES_ESTADO_OPORTUNIDAD.get(oportunidad.estado, []):
            raise ValueError("Transición de estado inválida")

        if nuevo_estado == EstadoOportunidad.PERDIDA.value and not motivo_perdida_id:
            raise ValueError("motivo_perdida_id es obligatorio al marcar Perdida")

        if nuevo_estado in (EstadoOportunidad.GANADA.value, EstadoOportunidad.RESERVA.value):
            if monto is None or moneda_id is None or condicion_pago_id is None:
                raise ValueError("monto, moneda_id y condicion_pago_id son obligatorios para Reserva/Ganada")

        estado_anterior = oportunidad.estado
        oportunidad.estado = nuevo_estado
        oportunidad.descripcion_estado = descripcion
        oportunidad.fecha_estado = self._parse_fecha(fecha_estado)

        if nuevo_estado in (
            EstadoOportunidad.ABIERTA.value,
            EstadoOportunidad.VISITA.value,
            EstadoOportunidad.COTIZA.value,
            EstadoOportunidad.RESERVA.value,
            EstadoOportunidad.GANADA.value,
            EstadoOportunidad.PERDIDA.value,
        ):
            oportunidad.activo = True

        if monto is not None:
            oportunidad.monto = monto
        if moneda_id is not None:
            oportunidad.moneda_id = moneda_id
        if condicion_pago_id is not None:
            oportunidad.condicion_pago_id = condicion_pago_id
        oportunidad.motivo_perdida_id = motivo_perdida_id

        session.add(oportunidad)
        session.commit()
        session.refresh(oportunidad)

        self._crear_log(session, oportunidad, usuario_id, descripcion, estado_anterior)
        self._sincronizar_propiedad(session, oportunidad, usuario_id, descripcion)
        session.commit()
        session.refresh(oportunidad)
        return oportunidad

    def _crear_log(
        self,
        session: Session,
        oportunidad: CRMOportunidad,
        usuario_id: int,
        descripcion: str,
        estado_anterior: str,
    ) -> None:
        log = CRMOportunidadLogEstado(
            oportunidad_id=oportunidad.id,
            estado_anterior=estado_anterior,
            estado_nuevo=oportunidad.estado,
            descripcion=descripcion,
            usuario_id=usuario_id,
        )
        session.add(log)

    def _sincronizar_propiedad(
        self,
        session: Session,
        oportunidad: CRMOportunidad,
        usuario_id: int,
        descripcion: str,
    ) -> None:
        """
        Si la oportunidad pasa a GANADA, actualizar la propiedad a Realizada
        y registrar el log de estado de propiedad.
        """
        if not oportunidad.propiedad_id:
            return
        if oportunidad.estado != EstadoOportunidad.GANADA.value:
            return

        propiedad = session.get(Propiedad, oportunidad.propiedad_id)
        if not propiedad:
            return

        estado_realizada = session.exec(
            select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
        ).first()
        if not estado_realizada:
            return

        prev_status_id = propiedad.propiedad_status_id
        fecha_cambio = (
            oportunidad.fecha_estado.date()
            if oportunidad.fecha_estado
            else date.today()
        )

        propiedad.propiedad_status_id = estado_realizada.id
        propiedad.estado_fecha = fecha_cambio
        propiedad.vacancia_activa = False
        propiedad.vacancia_fecha = None
        session.add(propiedad)

        if prev_status_id != estado_realizada.id:
            estado_anterior = (
                session.get(PropiedadesStatus, prev_status_id)
                if prev_status_id
                else None
            )
            motivo = descripcion.strip() if descripcion else None
            motivo_corto = motivo[:200] if motivo else None
            log = PropiedadesLogStatus(
                propiedad_id=propiedad.id,
                estado_anterior_id=prev_status_id,
                estado_nuevo_id=estado_realizada.id,
                estado_anterior=estado_anterior.nombre if estado_anterior else None,
                estado_nuevo=estado_realizada.nombre,
                fecha_cambio=datetime(
                    fecha_cambio.year,
                    fecha_cambio.month,
                    fecha_cambio.day,
                    tzinfo=UTC,
                ),
                usuario_id=usuario_id or 1,
                motivo=motivo_corto,
                observaciones=motivo,
            )
            session.add(log)

    def eliminar_oportunidad_y_relaciones(self, session: Session, oportunidad_id: int) -> None:
        oportunidad = session.get(CRMOportunidad, oportunidad_id)
        if not oportunidad:
            raise ValueError("Oportunidad no encontrada")
        if oportunidad.estado != EstadoOportunidad.PROSPECT.value:
            raise ValueError("Solo se puede descartar una oportunidad en estado 0-prospect")

        session.exec(
            update(CRMOportunidad)
            .where(CRMOportunidad.id == oportunidad_id)
            .values(ultimo_mensaje_id=None, ultimo_mensaje_at=None)
        )

        session.exec(delete(CRMEvento).where(CRMEvento.oportunidad_id == oportunidad_id))
        session.exec(delete(CRMMensaje).where(CRMMensaje.oportunidad_id == oportunidad_id))
        session.exec(
            delete(CRMOportunidadLogEstado).where(
                CRMOportunidadLogEstado.oportunidad_id == oportunidad_id
            )
        )
        session.exec(delete(CRMOportunidad).where(CRMOportunidad.id == oportunidad_id))

        session.commit()


crm_oportunidad_service = CRMOportunidadService()
