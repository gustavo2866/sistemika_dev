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


PRESENTISMO_EXCLUDED_ESTADOS = {"ENF", "ACC"}


def get_quincena_range(fecha):
    if fecha.day <= 15:
        return fecha.replace(day=1), fecha.replace(day=15)
    last_day = monthrange(fecha.year, fecha.month)[1]
    return fecha.replace(day=16), fecha.replace(day=last_day)


def get_jornada_esperada(fecha: date) -> Decimal:
    if not es_dia_laborable(fecha):
        return Decimal("0")
    if fecha.weekday() == 5:
        return Decimal("6")
    return Decimal("9")


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

    def get_tarja_para_parte(self, session: Session, parte_id: int) -> Tarja | None:
        parte = session.get(ParteDiario, parte_id)
        if parte is None or parte.deleted_at is not None:
            raise ValueError("Parte diario no encontrado")

        stmt = (
            select(Tarja)
            .where(Tarja.idproyecto == parte.idproyecto)
            .where(Tarja.fechainicio <= parte.fecha)
            .where(Tarja.fechafinal >= parte.fecha)
            .where(Tarja.deleted_at.is_(None))
        )
        if parte.contacto_id is None:
            stmt = stmt.where(Tarja.contacto_id.is_(None))
        else:
            stmt = stmt.where(Tarja.contacto_id == parte.contacto_id)
        return session.exec(stmt).first()

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
        nominas = self._get_nominas_para_encargado(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
        )
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
            .where(
                ParteDiario.contacto_id == contacto_id
                if contacto_id is not None
                else ParteDiario.contacto_id.is_(None)
            )
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
                        horas=detalle.horas if detalle else get_jornada_esperada(current_date),
                        descripcion=detalle.descripcion if detalle else None,
                        parte_diario_detalle_id=(
                            int(detalle.id) if detalle and detalle.id is not None else None
                        ),
                    )
                )

        session.flush()
        self._sync_tarja_novedades(session, tarja, nominas)
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
        if parte.estado not in {EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO}:
            raise ValueError("Solo se puede generar la tarja desde un parte diario confirmado o cerrado")
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

        nominas = self._get_nominas_para_encargado(
            session,
            idproyecto=parte.idproyecto,
            contacto_id=parte.contacto_id,
        )
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
                        horas=get_jornada_esperada(parte.fecha),
                        descripcion=None,
                        parte_diario_detalle_id=None,
                    )
                )

        session.flush()
        self._sync_tarja_novedades(session, tarja, nominas)
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

    def _get_nominas_para_encargado(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
    ) -> list[Nomina]:
        stmt = (
            select(Nomina)
            .where(Nomina.idproyecto == idproyecto)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .order_by(Nomina.apellido, Nomina.nombre)
        )
        if contacto_id is not None:
            stmt = stmt.where(Nomina.encargado_contacto_id == contacto_id)
        return list(session.exec(stmt).all())

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

    def _sync_tarja_novedades(
        self,
        session: Session,
        tarja: Tarja,
        nominas: list[Nomina],
    ) -> None:
        tarja_id = int(tarja.id)
        existing_novedades = session.exec(
            select(TarjaNovedad)
            .where(TarjaNovedad.tarja_id == tarja_id)
            .where(TarjaNovedad.deleted_at.is_(None))
        ).all()
        novedades_by_nomina = {
            int(novedad.nomina_id): novedad
            for novedad in existing_novedades
            if novedad.nomina_id is not None
        }
        detalle_rows = session.exec(
            select(TarjaDetalle, ParteDiarioEstado)
            .outerjoin(ParteDiarioEstado, ParteDiarioEstado.id == TarjaDetalle.idestado)
            .where(TarjaDetalle.tarja_id == tarja_id)
            .where(TarjaDetalle.deleted_at.is_(None))
        ).all()
        detalles_by_nomina: dict[int, list[tuple[TarjaDetalle, ParteDiarioEstado | None]]] = {}
        for detalle, estado in detalle_rows:
            if detalle.idnomina is None:
                continue
            detalles_by_nomina.setdefault(int(detalle.idnomina), []).append((detalle, estado))

        for nomina in nominas:
            if nomina.id is None:
                continue
            nomina_id = int(nomina.id)
            novedad = novedades_by_nomina.get(nomina_id)
            if novedad is None:
                novedad = TarjaNovedad(
                    tarja_id=tarja_id,
                    nomina_id=nomina_id,
                    horas_justificadas=Decimal("0"),
                    presentismo=False,
                    adicional=Decimal("0"),
                    premio=Decimal("0"),
                    observaciones=None,
                    documentos=[],
                )

            novedad.nomina_categoria_id = nomina.nomina_categoria_id
            novedad.nomina_tarea_id = nomina.nomina_tarea_id
            novedad.presentismo = self._calcular_presentismo(
                tarja,
                detalles_by_nomina.get(nomina_id, []),
            )
            if hasattr(novedad, "updated_at"):
                novedad.updated_at = datetime.now(UTC)
            session.add(novedad)

    def _calcular_presentismo(
        self,
        tarja: Tarja,
        detalles: list[tuple[TarjaDetalle, ParteDiarioEstado | None]],
    ) -> bool:
        detalles_by_fecha = {detalle.fecha: (detalle, estado) for detalle, estado in detalles}
        jornadas_consideradas = 0

        for current_date in self._iter_dates(tarja.fechainicio, tarja.fechafinal):
            jornada_esperada = get_jornada_esperada(current_date)
            if jornada_esperada <= 0:
                continue

            detalle_estado = detalles_by_fecha.get(current_date)
            if detalle_estado is None:
                return False

            detalle, estado = detalle_estado
            estado_codigo = str(estado.abreviatura if estado else "").strip().upper()
            if estado_codigo in PRESENTISMO_EXCLUDED_ESTADOS:
                continue

            jornadas_consideradas += 1
            if Decimal(str(detalle.horas or 0)) < jornada_esperada:
                return False

        return jornadas_consideradas > 0


parte_diario_tarja_service = ParteDiarioTarjaService()
