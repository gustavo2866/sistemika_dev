from __future__ import annotations

from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import json

from sqlmodel import Session, select

from agente.v3.subprocesses.parte_diario.calendario import es_dia_laborable
from app.models.nomina import Nomina
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import EstadoParteDiario, ParteDiario, ParteDiarioDetalle
from app.models.tarja import EstadoTarja, Tarja, TarjaDetalle, TarjaNomina


PRESENTISMO_EXCLUDED_ESTADOS = {"ENF", "ACC"}
ALTA_ESTADO_CODIGO = "ALT"
BAJA_ESTADO_CODIGO = "BAJ"
TRASPASO_ESTADO_CODIGO = "TRA"


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
    def asegurar_nomina_quincena(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fechainicio: date,
        fechafinal: date,
        auto_commit: bool = True,
    ) -> tuple[Tarja, int]:
        if fechafinal < fechainicio:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial")

        tarja = self._find_or_create_tarja(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
            fechainicio=fechainicio,
            fechafinal=fechafinal,
        )
        nominas = self._get_nominas_para_encargado(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
        )
        existing_ids = {
            int(nomina_id)
            for nomina_id in session.exec(
                select(TarjaNomina.nomina_id)
                .where(TarjaNomina.tarja_id == tarja.id)
                .where(TarjaNomina.nomina_id.is_not(None))
                .where(TarjaNomina.deleted_at.is_(None))
            ).all()
            if nomina_id is not None
        }
        if existing_ids:
            if auto_commit:
                session.commit()
                session.refresh(tarja)
            else:
                session.flush()
            return tarja, 0

        created = 0
        for nomina in nominas:
            if nomina.id is None or int(nomina.id) in existing_ids:
                continue
            if nomina.fecha_ingreso is not None and nomina.fecha_ingreso > fechafinal:
                continue
            if nomina.fecha_egreso is not None and nomina.fecha_egreso < fechainicio:
                continue
            fecha_desde = max(
                fechainicio,
                nomina.fecha_ingreso or fechainicio,
            )
            fecha_hasta = min(
                fechafinal,
                nomina.fecha_egreso or fechafinal,
            )
            session.add(
                TarjaNomina(
                    tarja_id=int(tarja.id),
                    nomina_id=int(nomina.id),
                    nomina_categoria_id=nomina.nomina_categoria_id,
                    nomina_tarea_id=nomina.nomina_tarea_id,
                    fecha_desde=fecha_desde,
                    fecha_hasta=fecha_hasta,
                    documentos=[],
                )
            )
            created += 1

        if auto_commit:
            session.commit()
            session.refresh(tarja)
        else:
            session.flush()
        return tarja, created

    def asegurar_tarja_borrador_quincena(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fechainicio: date,
        fechafinal: date,
        auto_commit: bool = True,
    ) -> Tarja:
        if fechafinal < fechainicio:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial")

        tarja = self._find_or_create_tarja(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
            fechainicio=fechainicio,
            fechafinal=fechafinal,
        )
        tarja.estado = EstadoTarja.BORRADOR
        if hasattr(tarja, "updated_at"):
            tarja.updated_at = datetime.now(UTC)
        session.add(tarja)
        if auto_commit:
            session.commit()
            session.refresh(tarja)
        else:
            session.flush()
        return tarja

    def cerrar_tarja(self, session: Session, tarja_id: int) -> tuple[Tarja, Tarja, int]:
        tarja = session.get(Tarja, tarja_id)
        if tarja is None or tarja.deleted_at is not None:
            raise ValueError("Tarja no encontrada")

        tarja.estado = EstadoTarja.CERRADO
        if hasattr(tarja, "updated_at"):
            tarja.updated_at = datetime.now(UTC)
        session.add(tarja)

        siguiente_inicio, siguiente_fin = get_quincena_range(
            tarja.fechafinal + timedelta(days=1)
        )
        siguiente, created = self.asegurar_nomina_quincena(
            session,
            idproyecto=tarja.idproyecto,
            contacto_id=tarja.contacto_id,
            fechainicio=siguiente_inicio,
            fechafinal=siguiente_fin,
            auto_commit=False,
        )
        session.commit()
        session.refresh(tarja)
        session.refresh(siguiente)
        return tarja, siguiente, created

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
        self.sincronizar_detalle_para_parte(session, parte, auto_commit=False)
        session.commit()
        session.refresh(parte)
        return parte

    def cerrar_parte(self, session: Session, parte_id: int) -> Tarja:
        return self._generar_tarja_y_cerrar_parte(session, parte_id)

    def registrar_tarja(self, session: Session, parte_id: int) -> Tarja:
        return self._generar_tarja_y_cerrar_parte(session, parte_id)

    def sincronizar_detalle_para_parte(
        self,
        session: Session,
        parte: ParteDiario,
        *,
        auto_commit: bool = True,
    ) -> Tarja:
        tarja = self._sync_tarja_detalle_para_parte(session, parte, cerrar_parte=False)
        if auto_commit:
            session.commit()
            session.refresh(tarja)
        else:
            session.flush()
        return tarja

    def asegurar_tarja_nomina_para_parte(
        self,
        session: Session,
        parte: ParteDiario,
        *,
        auto_commit: bool = True,
    ) -> tuple[Tarja, int]:
        quincena_inicio, quincena_final = get_quincena_range(parte.fecha)
        return self.asegurar_nomina_quincena(
            session,
            idproyecto=parte.idproyecto,
            contacto_id=parte.contacto_id,
            fechainicio=quincena_inicio,
            fechafinal=quincena_final,
            auto_commit=auto_commit,
        )

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
        self._sync_tarja_nomina(session, tarja, nominas)
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

        tarja = self._sync_tarja_detalle_para_parte(session, parte, cerrar_parte=True)
        session.commit()
        session.refresh(tarja)
        return tarja

    def _sync_tarja_detalle_para_parte(
        self,
        session: Session,
        parte: ParteDiario,
        *,
        cerrar_parte: bool,
    ) -> Tarja:
        presente = self._get_estado_presente(session)

        quincena_inicio, quincena_final = get_quincena_range(parte.fecha)
        tarja, _created = self.asegurar_nomina_quincena(
            session,
            idproyecto=parte.idproyecto,
            contacto_id=parte.contacto_id,
            fechainicio=quincena_inicio,
            fechafinal=quincena_final,
            auto_commit=False,
        )
        tarja.estado = EstadoTarja.BORRADOR
        tarja.descripcion = parte.descripcion
        if hasattr(tarja, "updated_at"):
            tarja.updated_at = datetime.now(UTC)
        session.add(tarja)
        self._clear_tarja_fecha(session, int(tarja.id), parte.fecha)

        parte_detalles = session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id == parte.id)
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        alta_detalles = self._get_alta_detalles(session, parte_detalles)
        baja_detalles = self._get_baja_detalles(session, parte_detalles)
        traspaso_detalles = self._get_detalles_por_estado(
            session,
            parte_detalles,
            TRASPASO_ESTADO_CODIGO,
        )
        alta_detalle_ids = {
            int(detalle.id)
            for detalle in alta_detalles
            if detalle.id is not None
        }
        baja_detalle_ids = {
            int(detalle.id)
            for detalle in baja_detalles
            if detalle.id is not None
        }
        traspaso_detalle_ids = {
            int(detalle.id)
            for detalle in traspaso_detalles
            if detalle.id is not None
        }
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
            es_alta = detalle.id is not None and int(detalle.id) in alta_detalle_ids
            es_baja = detalle.id is not None and int(detalle.id) in baja_detalle_ids
            es_traspaso = detalle.id is not None and int(detalle.id) in traspaso_detalle_ids
            detalle_estado_id = presente.id if es_alta else detalle.idestado
            detalle_horas = (
                get_jornada_esperada(parte.fecha)
                if es_alta
                else Decimal("0")
                if es_baja or es_traspaso
                else detalle.horas
            )
            session.add(
                TarjaDetalle(
                    tarja_id=int(tarja.id),
                    idnomina=detalle.idnomina,
                    fecha=parte.fecha,
                    idestado=detalle_estado_id,
                    horas=detalle_horas,
                    descripcion=None if es_alta else detalle.descripcion,
                    parte_diario_detalle_id=int(detalle.id) if detalle.id is not None else None,
                )
            )

        if alta_detalles:
            session.flush()
            self._sync_tarja_detalles_desde_altas(
                session,
                tarja=tarja,
                parte=parte,
                alta_detalles=alta_detalles,
                quincena_inicio=quincena_inicio,
                quincena_final=quincena_final,
                presente_id=int(presente.id),
            )

        if baja_detalles:
            session.flush()
            self._sync_tarja_detalles_desde_bajas(
                session,
                tarja=tarja,
                parte=parte,
                baja_detalles=baja_detalles,
                quincena_final=quincena_final,
            )

        if traspaso_detalles:
            session.flush()
            self._sync_tarja_detalles_desde_traspasos(
                session,
                source_tarja=tarja,
                parte=parte,
                traspaso_detalles=traspaso_detalles,
                quincena_final=quincena_final,
                presente_id=int(presente.id),
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
        self._sync_tarja_nomina(session, tarja, nominas)
        if cerrar_parte:
            parte.estado = EstadoParteDiario.CERRADO
            if hasattr(parte, "updated_at"):
                parte.updated_at = datetime.now(UTC)
            session.add(parte)
        return tarja

    def _get_alta_detalles(
        self,
        session: Session,
        parte_detalles: list[ParteDiarioDetalle],
    ) -> list[ParteDiarioDetalle]:
        estado_ids = {
            int(detalle.idestado)
            for detalle in parte_detalles
            if detalle.idnomina is not None and detalle.idestado is not None
        }
        if not estado_ids:
            return []

        estados = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.id.in_(estado_ids))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        alta_estado_ids = {
            int(estado.id)
            for estado in estados
            if str(estado.abreviatura or "").strip().upper() == ALTA_ESTADO_CODIGO
        }
        if not alta_estado_ids:
            return []

        return [
            detalle
            for detalle in parte_detalles
            if detalle.idnomina is not None and detalle.idestado in alta_estado_ids
        ]

    def _get_baja_detalles(
        self,
        session: Session,
        parte_detalles: list[ParteDiarioDetalle],
    ) -> list[ParteDiarioDetalle]:
        return self._get_detalles_por_estado(session, parte_detalles, BAJA_ESTADO_CODIGO)

    def _get_detalles_por_estado(
        self,
        session: Session,
        parte_detalles: list[ParteDiarioDetalle],
        codigo: str,
    ) -> list[ParteDiarioDetalle]:
        estado_ids = {
            int(detalle.idestado)
            for detalle in parte_detalles
            if detalle.idnomina is not None and detalle.idestado is not None
        }
        if not estado_ids:
            return []

        estados = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.id.in_(estado_ids))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        matching_estado_ids = {
            int(estado.id)
            for estado in estados
            if str(estado.abreviatura or "").strip().upper() == codigo
        }
        if not matching_estado_ids:
            return []

        return [
            detalle
            for detalle in parte_detalles
            if detalle.idnomina is not None and detalle.idestado in matching_estado_ids
        ]

    def _sync_tarja_detalles_desde_bajas(
        self,
        session: Session,
        *,
        tarja: Tarja,
        parte: ParteDiario,
        baja_detalles: list[ParteDiarioDetalle],
        quincena_final: date,
    ) -> None:
        tarja_id = int(tarja.id)
        baja_nomina_ids = {
            int(detalle.idnomina)
            for detalle in baja_detalles
            if detalle.idnomina is not None
        }
        if not baja_nomina_ids:
            return

        for detalle in session.exec(
            select(TarjaDetalle)
            .where(TarjaDetalle.tarja_id == tarja_id)
            .where(TarjaDetalle.idnomina.in_(baja_nomina_ids))
            .where(TarjaDetalle.fecha > parte.fecha)
            .where(TarjaDetalle.fecha <= quincena_final)
        ).all():
            session.delete(detalle)

        registros = session.exec(
            select(TarjaNomina)
            .where(TarjaNomina.tarja_id == tarja_id)
            .where(TarjaNomina.nomina_id.in_(baja_nomina_ids))
            .where(TarjaNomina.deleted_at.is_(None))
        ).all()
        for registro in registros:
            registro.fecha_hasta = parte.fecha
            if hasattr(registro, "updated_at"):
                registro.updated_at = datetime.now(UTC)
            session.add(registro)

        nominas = session.exec(
            select(Nomina)
            .where(Nomina.id.in_(baja_nomina_ids))
            .where(Nomina.deleted_at.is_(None))
        ).all()
        for nomina in nominas:
            nomina.fecha_egreso = parte.fecha
            nomina.activo = False
            if hasattr(nomina, "updated_at"):
                nomina.updated_at = datetime.now(UTC)
            session.add(nomina)

        session.flush()

    def _sync_tarja_detalles_desde_traspasos(
        self,
        session: Session,
        *,
        source_tarja: Tarja,
        parte: ParteDiario,
        traspaso_detalles: list[ParteDiarioDetalle],
        quincena_final: date,
        presente_id: int,
    ) -> None:
        source_tarja_id = int(source_tarja.id)
        for detalle in traspaso_detalles:
            if detalle.idnomina is None:
                continue
            payload = self._parse_traspaso_payload(detalle)
            destino = payload.get("destino") if isinstance(payload.get("destino"), dict) else {}
            destino_proyecto_id = self._payload_int(destino.get("idproyecto"))
            destino_contacto_id = self._payload_int(destino.get("contacto_id"))
            if destino_proyecto_id is None:
                raise ValueError("El traspaso no tiene obra destino")
            if destino_contacto_id is None:
                raise ValueError("El traspaso no tiene encargado destino")
            if (
                destino_proyecto_id == parte.idproyecto
                and destino_contacto_id == parte.contacto_id
            ):
                raise ValueError("La obra y encargado destino deben ser diferentes al origen")

            nomina_id = int(detalle.idnomina)
            for source_detalle in session.exec(
                select(TarjaDetalle)
                .where(TarjaDetalle.tarja_id == source_tarja_id)
                .where(TarjaDetalle.idnomina == nomina_id)
                .where(TarjaDetalle.fecha > parte.fecha)
                .where(TarjaDetalle.fecha <= quincena_final)
            ).all():
                session.delete(source_detalle)

            for source_registro in session.exec(
                select(TarjaNomina)
                .where(TarjaNomina.tarja_id == source_tarja_id)
                .where(TarjaNomina.nomina_id == nomina_id)
                .where(TarjaNomina.deleted_at.is_(None))
            ).all():
                source_registro.fecha_hasta = parte.fecha
                if hasattr(source_registro, "updated_at"):
                    source_registro.updated_at = datetime.now(UTC)
                session.add(source_registro)

            destination_tarja = self._find_or_create_tarja(
                session,
                idproyecto=destino_proyecto_id,
                contacto_id=destino_contacto_id,
                fechainicio=source_tarja.fechainicio,
                fechafinal=source_tarja.fechafinal,
            )
            destination_registro = session.exec(
                select(TarjaNomina)
                .where(TarjaNomina.tarja_id == int(destination_tarja.id))
                .where(TarjaNomina.nomina_id == nomina_id)
                .where(TarjaNomina.deleted_at.is_(None))
            ).first()
            nomina = session.get(Nomina, nomina_id)
            if nomina is None or nomina.deleted_at is not None:
                raise ValueError("El empleado asociado al traspaso no existe")
            if destination_registro is None:
                destination_registro = TarjaNomina(
                    tarja_id=int(destination_tarja.id),
                    nomina_id=nomina_id,
                    nomina_categoria_id=nomina.nomina_categoria_id,
                    nomina_tarea_id=nomina.nomina_tarea_id,
                    fecha_desde=parte.fecha,
                    fecha_hasta=source_tarja.fechafinal,
                    documentos=[],
                )
            else:
                destination_registro.fecha_desde = min(destination_registro.fecha_desde, parte.fecha)
                destination_registro.fecha_hasta = source_tarja.fechafinal
            if hasattr(destination_registro, "updated_at"):
                destination_registro.updated_at = datetime.now(UTC)
            session.add(destination_registro)

            nomina.idproyecto = destino_proyecto_id
            nomina.encargado_contacto_id = destino_contacto_id
            nomina.fecha_egreso = None
            nomina.activo = True
            if hasattr(nomina, "updated_at"):
                nomina.updated_at = datetime.now(UTC)
            session.add(nomina)
            session.flush()

            traspaso_descripcion = self._build_traspaso_tarja_descripcion(payload)
            self._sync_destination_detalles_desde_traspaso(
                session,
                destination_tarja=destination_tarja,
                parte=parte,
                nomina_id=nomina_id,
                quincena_final=quincena_final,
                presente_id=presente_id,
                parte_diario_detalle_id=(
                    int(detalle.id) if detalle.id is not None else None
                ),
                descripcion=traspaso_descripcion,
            )
        session.flush()

    def _sync_destination_detalles_desde_traspaso(
        self,
        session: Session,
        *,
        destination_tarja: Tarja,
        parte: ParteDiario,
        nomina_id: int,
        quincena_final: date,
        presente_id: int,
        parte_diario_detalle_id: int | None,
        descripcion: str,
    ) -> None:
        destination_tarja_id = int(destination_tarja.id)
        partes_confirmados = session.exec(
            select(ParteDiario)
            .where(ParteDiario.idproyecto == destination_tarja.idproyecto)
            .where(ParteDiario.fecha >= parte.fecha)
            .where(ParteDiario.fecha <= quincena_final)
            .where(ParteDiario.estado.in_([EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO]))
            .where(ParteDiario.deleted_at.is_(None))
            .where(
                ParteDiario.contacto_id == destination_tarja.contacto_id
                if destination_tarja.contacto_id is not None
                else ParteDiario.contacto_id.is_(None)
            )
        ).all()
        fechas = {parte.fecha}
        fechas.update(confirmed.fecha for confirmed in partes_confirmados)
        existing_dates = {
            detalle.fecha
            for detalle in session.exec(
                select(TarjaDetalle)
                .where(TarjaDetalle.tarja_id == destination_tarja_id)
                .where(TarjaDetalle.idnomina == nomina_id)
                .where(TarjaDetalle.fecha >= parte.fecha)
                .where(TarjaDetalle.fecha <= quincena_final)
                .where(TarjaDetalle.deleted_at.is_(None))
            ).all()
        }
        for fecha in sorted(fechas):
            if fecha in existing_dates:
                continue
            session.add(
                TarjaDetalle(
                    tarja_id=destination_tarja_id,
                    idnomina=nomina_id,
                    fecha=fecha,
                    idestado=presente_id,
                    horas=get_jornada_esperada(fecha),
                    descripcion=descripcion,
                    parte_diario_detalle_id=parte_diario_detalle_id,
                )
            )

    def _build_traspaso_tarja_descripcion(self, payload: dict) -> str:
        origen = payload.get("origen") if isinstance(payload.get("origen"), dict) else {}
        obra = str(origen.get("obra") or "").strip()
        encargado = str(origen.get("encargado") or "").strip()
        label = " - ".join(value for value in [obra, encargado] if value)
        return f"TRASPASO: {label}" if label else "TRASPASO"

    def _parse_traspaso_payload(self, detalle: ParteDiarioDetalle) -> dict:
        try:
            parsed = json.loads(detalle.descripcion or "{}")
        except (TypeError, ValueError):
            return {}
        return parsed if isinstance(parsed, dict) else {}

    def _payload_int(self, value) -> int | None:
        if value in (None, ""):
            return None
        try:
            result = int(value)
        except (TypeError, ValueError):
            return None
        return result if result > 0 else None

    def _sync_tarja_detalles_desde_altas(
        self,
        session: Session,
        *,
        tarja: Tarja,
        parte: ParteDiario,
        alta_detalles: list[ParteDiarioDetalle],
        quincena_inicio: date,
        quincena_final: date,
        presente_id: int,
    ) -> None:
        tarja_id = int(tarja.id)
        alta_nomina_ids = {
            int(detalle.idnomina)
            for detalle in alta_detalles
            if detalle.idnomina is not None
        }
        if not alta_nomina_ids:
            return

        for detalle in session.exec(
            select(TarjaDetalle)
            .where(TarjaDetalle.tarja_id == tarja_id)
            .where(TarjaDetalle.idnomina.in_(alta_nomina_ids))
            .where(TarjaDetalle.fecha >= quincena_inicio)
            .where(TarjaDetalle.fecha < parte.fecha)
        ).all():
            session.delete(detalle)
        session.flush()

        partes_confirmados = session.exec(
            select(ParteDiario)
            .where(ParteDiario.idproyecto == parte.idproyecto)
            .where(ParteDiario.fecha >= parte.fecha)
            .where(ParteDiario.fecha <= quincena_final)
            .where(ParteDiario.estado.in_([EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO]))
            .where(ParteDiario.deleted_at.is_(None))
            .where(
                ParteDiario.contacto_id == parte.contacto_id
                if parte.contacto_id is not None
                else ParteDiario.contacto_id.is_(None)
            )
        ).all()
        partes_by_id = {
            int(confirmed_parte.id): confirmed_parte
            for confirmed_parte in partes_confirmados
            if confirmed_parte.id is not None
        }
        if not partes_by_id:
            return

        detalle_rows = session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id.in_(partes_by_id.keys()))
            .where(ParteDiarioDetalle.idnomina.in_(alta_nomina_ids))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        alta_detalle_ids = {
            int(detalle.id)
            for detalle in self._get_alta_detalles(session, list(detalle_rows))
            if detalle.id is not None
        }
        detalles_by_parte_nomina = {
            (int(detalle.parte_diario_id), int(detalle.idnomina)): detalle
            for detalle in detalle_rows
            if detalle.idnomina is not None
        }
        existing_keys = {
            (detalle.fecha, int(detalle.idnomina))
            for detalle in session.exec(
                select(TarjaDetalle)
                .where(TarjaDetalle.tarja_id == tarja_id)
                .where(TarjaDetalle.idnomina.in_(alta_nomina_ids))
                .where(TarjaDetalle.fecha >= parte.fecha)
                .where(TarjaDetalle.fecha <= quincena_final)
            ).all()
            if detalle.idnomina is not None
        }

        for confirmed_parte in partes_confirmados:
            for nomina_id in alta_nomina_ids:
                key = (confirmed_parte.fecha, nomina_id)
                if key in existing_keys:
                    continue
                detalle = detalles_by_parte_nomina.get((int(confirmed_parte.id), nomina_id))
                if detalle is None and not es_dia_laborable(confirmed_parte.fecha):
                    continue
                es_alta = detalle is not None and detalle.id is not None and int(detalle.id) in alta_detalle_ids
                detalle_estado_id = presente_id
                detalle_horas = get_jornada_esperada(confirmed_parte.fecha)
                detalle_descripcion = None
                if detalle is not None and not es_alta:
                    detalle_estado_id = detalle.idestado
                    detalle_horas = detalle.horas
                    detalle_descripcion = detalle.descripcion
                session.add(
                    TarjaDetalle(
                        tarja_id=tarja_id,
                        idnomina=nomina_id,
                        fecha=confirmed_parte.fecha,
                        idestado=detalle_estado_id,
                        horas=detalle_horas,
                        descripcion=detalle_descripcion,
                        parte_diario_detalle_id=(
                            int(detalle.id) if detalle and detalle.id is not None else None
                        ),
                    )
                )
                existing_keys.add(key)

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

    def _find_or_create_tarja(
        self,
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fechainicio: date,
        fechafinal: date,
    ) -> Tarja:
        query = (
            select(Tarja)
            .where(Tarja.idproyecto == idproyecto)
            .where(Tarja.fechainicio == fechainicio)
            .where(Tarja.fechafinal == fechafinal)
            .where(Tarja.deleted_at.is_(None))
        )
        query = (
            query.where(Tarja.contacto_id.is_(None))
            if contacto_id is None
            else query.where(Tarja.contacto_id == contacto_id)
        )
        tarja = session.exec(query).first()
        if tarja is not None:
            return tarja

        tarja = Tarja(
            idproyecto=idproyecto,
            contacto_id=contacto_id,
            fechainicio=fechainicio,
            fechafinal=fechafinal,
            estado=EstadoTarja.BORRADOR,
        )
        session.add(tarja)
        session.flush()
        return tarja

    def _iter_dates(self, start: date, end: date):
        current = start
        while current <= end:
            yield current
            current += timedelta(days=1)

    def _sync_tarja_nomina(
        self,
        session: Session,
        tarja: Tarja,
        _nominas: list[Nomina],
    ) -> None:
        tarja_id = int(tarja.id)
        existing_registros = session.exec(
            select(TarjaNomina)
            .where(TarjaNomina.tarja_id == tarja_id)
            .where(TarjaNomina.deleted_at.is_(None))
        ).all()
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

        for registro in existing_registros:
            if registro.nomina_id is None:
                continue
            nomina_id = int(registro.nomina_id)
            registro.presentismo = self._calcular_presentismo(
                tarja,
                detalles_by_nomina.get(nomina_id, []),
            )
            if hasattr(registro, "updated_at"):
                registro.updated_at = datetime.now(UTC)
            session.add(registro)

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
