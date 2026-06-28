from __future__ import annotations

from calendar import monthrange
from datetime import UTC, datetime
from decimal import Decimal

from sqlmodel import Session, select

from app.models.nomina import Nomina
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import EstadoParteDiario, ParteDiario, ParteDiarioDetalle
from app.models.tarja import EstadoTarja, Tarja, TarjaDetalle, TarjaNovedad


def get_quincena_range(fecha):
    if fecha.day <= 15:
        return fecha.replace(day=1), fecha.replace(day=15)
    last_day = monthrange(fecha.year, fecha.month)[1]
    return fecha.replace(day=16), fecha.replace(day=last_day)


class ParteDiarioTarjaService:
    def cerrar_parte(self, session: Session, parte_id: int) -> ParteDiario:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")
        if parte.estado != EstadoParteDiario.BORRADOR:
            raise ValueError("Solo se puede cerrar un parte diario en borrador")

        parte.estado = EstadoParteDiario.CERRADO
        if hasattr(parte, "updated_at"):
            parte.updated_at = datetime.now(UTC)
        session.add(parte)
        session.commit()
        session.refresh(parte)
        return parte

    def abrir_parte(self, session: Session, parte_id: int) -> ParteDiario:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")
        if parte.estado not in {EstadoParteDiario.CERRADO, EstadoParteDiario.REGISTRADO}:
            raise ValueError("Solo se puede abrir un parte diario cerrado o registrado")

        parte.estado = EstadoParteDiario.BORRADOR
        if hasattr(parte, "updated_at"):
            parte.updated_at = datetime.now(UTC)
        session.add(parte)
        session.commit()
        session.refresh(parte)
        return parte

    def registrar_tarja(self, session: Session, parte_id: int) -> Tarja:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")
        if parte.estado != EstadoParteDiario.CERRADO:
            raise ValueError("Solo se puede registrar una tarja desde un parte diario cerrado")
        if not parte.contacto_id:
            raise ValueError("El parte diario no tiene encargado/contacto asociado")

        presente = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.abreviatura == "P")
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).first()
        if presente is None:
            raise ValueError("No existe estado PRESENTE activo para generar la tarja")

        quincena_inicio, quincena_final = get_quincena_range(parte.fecha)
        tarja = session.exec(
            select(Tarja)
            .where(Tarja.idproyecto == parte.idproyecto)
            .where(Tarja.contacto_id == parte.contacto_id)
            .where(Tarja.fechainicio == quincena_inicio)
            .where(Tarja.fechafinal == quincena_final)
            .where(Tarja.deleted_at.is_(None))
        ).first()
        if tarja is None:
            tarja = Tarja(
                idproyecto=parte.idproyecto,
                contacto_id=parte.contacto_id,
                fechainicio=quincena_inicio,
                fechafinal=quincena_final,
                estado=EstadoTarja.BORRADOR,
                descripcion=parte.descripcion,
            )
            session.add(tarja)
            session.flush()
        else:
            tarja.estado = EstadoTarja.BORRADOR
            tarja.descripcion = parte.descripcion
            if hasattr(tarja, "updated_at"):
                tarja.updated_at = datetime.now(UTC)
            session.add(tarja)
            session.flush()
            self._clear_tarja_fecha(session, int(tarja.id), parte.fecha)

        parte_detalles = session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id == parte.id)
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        detalles_by_nomina = {
            detalle.idnomina: detalle
            for detalle in parte_detalles
            if detalle.idnomina is not None
        }

        nominas = session.exec(
            select(Nomina)
            .where(Nomina.idproyecto == parte.idproyecto)
            .where(Nomina.encargado_contacto_id == parte.contacto_id)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .order_by(Nomina.apellido, Nomina.nombre)
        ).all()
        for detalle in parte_detalles:
            if detalle.idnomina is None:
                continue
            session.add(
                TarjaDetalle(
                    tarja_id=int(tarja.id),
                    idnomina=detalle.idnomina,
                    fecha=parte.fecha,
                    idestado=detalle.idestado,
                    horas=detalle.horas,
                    descripcion=detalle.descripcion,
                    parte_diario_detalle_id=int(detalle.id) if detalle.id is not None else None,
                )
            )

        for nomina in nominas:
            if nomina.id in detalles_by_nomina:
                continue
            session.add(
                TarjaDetalle(
                    tarja_id=int(tarja.id),
                    idnomina=nomina.id,
                    fecha=parte.fecha,
                    idestado=presente.id,
                    horas=Decimal("9"),
                    descripcion=None,
                    parte_diario_detalle_id=None,
                )
            )

        self._ensure_tarja_novedad(session, int(tarja.id))
        parte.estado = EstadoParteDiario.REGISTRADO
        if hasattr(parte, "updated_at"):
            parte.updated_at = datetime.now(UTC)
        session.add(parte)
        session.commit()
        session.refresh(tarja)
        return tarja

    def _clear_tarja_fecha(self, session: Session, tarja_id: int, fecha) -> None:
        for detalle in session.exec(
            select(TarjaDetalle)
            .where(TarjaDetalle.tarja_id == tarja_id)
            .where(TarjaDetalle.fecha == fecha)
        ).all():
            session.delete(detalle)
        session.flush()

    def _ensure_tarja_novedad(self, session: Session, tarja_id: int) -> None:
        novedad = session.exec(
            select(TarjaNovedad).where(TarjaNovedad.tarja_id == tarja_id)
        ).first()
        if novedad is not None:
            return
        session.add(
            TarjaNovedad(
                tarja_id=tarja_id,
                horas_enfermedad_justif=Decimal("0"),
                presentismo=Decimal("0"),
                premio=Decimal("0"),
                observaciones=None,
                documentos=[],
            )
        )


parte_diario_tarja_service = ParteDiarioTarjaService()
