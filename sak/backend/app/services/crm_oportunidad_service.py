from __future__ import annotations

from datetime import UTC, datetime, date
from typing import Optional

from sqlmodel import Session, select

from app.models import (
    CRMOportunidad,
    CRMOportunidadLogEstado,
    CRMContacto,
    CRMCondicionPago,
    CRMMotivoPerdida,
    Moneda,
    Propiedad,
    Vacancia,
)
from app.models.enums import (
    EstadoOportunidad,
    TRANSICIONES_ESTADO_OPORTUNIDAD,
    EstadoPropiedad,
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
        self._sincronizar_propiedad(session, oportunidad)
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

    def _sincronizar_propiedad(self, session: Session, oportunidad: CRMOportunidad) -> None:
        propiedad = session.get(Propiedad, oportunidad.propiedad_id)
        if not propiedad:
            return

        hoy = date.today()

        if oportunidad.estado == EstadoOportunidad.GANADA.value:
            propiedad.estado = EstadoPropiedad.REALIZADA.value
            vacancia = self._vacancia_activa(session, propiedad.id)
            if vacancia:
                vacancia.fecha_alquilada = hoy
                vacancia.ciclo_activo = False
                session.add(vacancia)
        elif oportunidad.estado in (
            EstadoOportunidad.ABIERTA.value,
            EstadoOportunidad.VISITA.value,
            EstadoOportunidad.COTIZA.value,
            EstadoOportunidad.RESERVA.value,
            EstadoOportunidad.PERDIDA.value,
        ):
            propiedad.estado = EstadoPropiedad.DISPONIBLE.value
            vacancia = self._vacancia_activa(session, propiedad.id)
            if not vacancia:
                vacancia = Vacancia(propiedad_id=propiedad.id, ciclo_activo=True, fecha_recibida=hoy, fecha_disponible=hoy)
                session.add(vacancia)
            else:
                if vacancia.fecha_disponible is None:
                    vacancia.fecha_disponible = hoy
                vacancia.ciclo_activo = True
                session.add(vacancia)

        session.add(propiedad)

    def _vacancia_activa(self, session: Session, propiedad_id: int) -> Optional[Vacancia]:
        return session.exec(
            select(Vacancia)
            .where(Vacancia.propiedad_id == propiedad_id)
            .where(Vacancia.ciclo_activo == True)
            .order_by(Vacancia.id.desc())
        ).first()


crm_oportunidad_service = CRMOportunidadService()
