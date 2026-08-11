from __future__ import annotations

from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from agente.v3.subprocesses.parte_diario.calendario import es_dia_laborable
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
    def confirmar_parte(self, session: Session, parte_id: int) -> ParteDiario:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")
        if parte.estado != EstadoParteDiario.BORRADOR:
            raise ValueError("Solo se puede confirmar un parte diario en borrador")

        parte.estado = EstadoParteDiario.CONFIRMADO
        if hasattr(parte, "updated_at"):
            parte.updated_at = datetime.now(UTC)
        session.add(parte)
        session.commit()
        session.refresh(parte)
        return parte

    def cerrar_parte(self, session: Session, parte_id: int) -> Tarja:
        return self._generar_tarja_y_cerrar_parte(session, parte_id)

    def registrar_tarja(self, session: Session, parte_id: int) -> Tarja:
        return self._generar_tarja_y_cerrar_parte(session, parte_id)

    def generar_tarja_desde_panel(
        self,
        session: Session,
        *,
        idproyecto: int,
        fechainicio: date,
        fechafinal: date,
        contacto_id: int | None = None,
    ) -> Tarja:
        if fechafinal < fechainicio:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial")

        presente = self._get_estado_presente(session)
        nominas = session.exec(
            select(Nomina)
            .where(Nomina.idproyecto == idproyecto)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .order_by(Nomina.apellido, Nomina.nombre)
        ).all()
        if not nominas:
            raise ValueError("No hay nomina activa para generar la tarja")

        tarja = self._get_or_create_tarja(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
            fechainicio=fechainicio,
            fechafinal=fechafinal,
            descripcion=None,
        )
        self._clear_tarja(session, int(tarja.id))

        parte_detalles = session.exec(
            select(ParteDiarioDetalle, ParteDiario.fecha)
            .join(ParteDiario)
            .where(ParteDiario.idproyecto == idproyecto)
            .where(ParteDiario.fecha >= fechainicio)
            .where(ParteDiario.fecha <= fechafinal)
            .where(ParteDiario.deleted_at.is_(None))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        detalles_by_fecha_nomina = {
            (parte_fecha, detalle.idnomina): detalle
            for detalle, parte_fecha in parte_detalles
            if detalle.idnomina is not None
        }

        for current_date in self._iter_dates(fechainicio, fechafinal):
            for nomina in nominas:
                detalle = detalles_by_fecha_nomina.get((current_date, nomina.id))
                if detalle is None and not es_dia_laborable(current_date):
                    continue
                session.add(
                    TarjaDetalle(
                        tarja_id=int(tarja.id),
                        idnomina=nomina.id,
                        fecha=current_date,
                        idestado=detalle.idestado if detalle else presente.id,
                        horas=detalle.horas if detalle else Decimal("9"),
                        descripcion=detalle.descripcion if detalle else None,
                        parte_diario_detalle_id=(
                            int(detalle.id) if detalle and detalle.id is not None else None
                        ),
                    )
                )

        self._ensure_tarja_novedad(session, int(tarja.id))
        if hasattr(tarja, "updated_at"):
            tarja.updated_at = datetime.now(UTC)
        session.add(tarja)
        session.commit()
        session.refresh(tarja)
        return tarja

    def abrir_parte(self, session: Session, parte_id: int) -> ParteDiario:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")
        if parte.estado not in {EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO}:
            raise ValueError("Solo se puede abrir un parte diario confirmado o cerrado")

        parte.estado = EstadoParteDiario.BORRADOR
        if hasattr(parte, "updated_at"):
            parte.updated_at = datetime.now(UTC)
        session.add(parte)
        session.commit()
        session.refresh(parte)
        return parte

    def _generar_tarja_y_cerrar_parte(self, session: Session, parte_id: int) -> Tarja:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")
        if parte.estado != EstadoParteDiario.CONFIRMADO:
            raise ValueError("Solo se puede cerrar un parte diario confirmado")
        if not parte.contacto_id:
            raise ValueError("El parte diario no tiene encargado/contacto asociado")

        presente = self._get_estado_presente(session)

        quincena_inicio, quincena_final = get_quincena_range(parte.fecha)
        tarja = self._get_or_create_tarja(
            session,
            idproyecto=parte.idproyecto,
            contacto_id=parte.contacto_id,
            fechainicio=quincena_inicio,
            fechafinal=quincena_final,
            descripcion=parte.descripcion,
        )
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

        if es_dia_laborable(parte.fecha):
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
        parte.estado = EstadoParteDiario.CERRADO
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

    def _clear_tarja(self, session: Session, tarja_id: int) -> None:
        for detalle in session.exec(
            select(TarjaDetalle).where(TarjaDetalle.tarja_id == tarja_id)
        ).all():
            session.delete(detalle)
        for novedad in session.exec(
            select(TarjaNovedad).where(TarjaNovedad.tarja_id == tarja_id)
        ).all():
            session.delete(novedad)
        session.flush()

    def _get_estado_presente(self, session: Session) -> ParteDiarioEstado:
        presente = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.abreviatura == "P")
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).first()
        if presente is None:
            raise ValueError("No existe estado PRESENTE activo para generar la tarja")
        return presente

    def _get_or_create_tarja(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fechainicio: date,
        fechafinal: date,
        descripcion: str | None,
    ) -> Tarja:
        query = (
            select(Tarja)
            .where(Tarja.idproyecto == idproyecto)
            .where(Tarja.fechainicio == fechainicio)
            .where(Tarja.fechafinal == fechafinal)
            .where(Tarja.deleted_at.is_(None))
        )
        if contacto_id is None:
            query = query.where(Tarja.contacto_id.is_(None))
        else:
            query = query.where(Tarja.contacto_id == contacto_id)

        tarja = session.exec(query).first()
        if tarja is None:
            tarja = Tarja(
                idproyecto=idproyecto,
                contacto_id=contacto_id,
                fechainicio=fechainicio,
                fechafinal=fechafinal,
                estado=EstadoTarja.BORRADOR,
                descripcion=descripcion,
            )
            session.add(tarja)
            session.flush()
            return tarja

        tarja.estado = EstadoTarja.BORRADOR
        tarja.descripcion = descripcion
        if hasattr(tarja, "updated_at"):
            tarja.updated_at = datetime.now(UTC)
        session.add(tarja)
        session.flush()
        return tarja

    def _iter_dates(self, start: date, end: date):
        current = start
        while current <= end:
            yield current
            current += timedelta(days=1)

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
