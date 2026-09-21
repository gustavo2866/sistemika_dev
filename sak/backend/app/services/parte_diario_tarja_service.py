from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import json

from sqlmodel import Session, select

from agente.v3.subprocesses.parte_diario.utils.calendario import es_dia_laborable
from app.models.nomina import Nomina
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import EstadoParteDiario, ParteDiario, ParteDiarioDetalle
from app.models.proyecto import Proyecto
from app.models.tarja import EstadoTarja, Tarja, TarjaDetalle, TarjaNomina
from app.utils.quincenas import get_quincena_range
from app.utils.jornada import get_jornada_esperada


PRESENTISMO_EXCLUDED_ESTADOS = {"ENF", "ACC"}
ALTA_ESTADO_CODIGO = "ALT"
BAJA_ESTADO_CODIGO = "BAJ"
TRASPASO_ESTADO_CODIGO = "TRA"


class ParteDiarioTarjaService:
    @staticmethod
    def get_viaticos_default(session: Session, idproyecto: int) -> bool:
        proyecto = session.get(Proyecto, idproyecto)
        if proyecto is None or proyecto.deleted_at is not None:
            return False
        return "san pablo" in str(proyecto.nombre or "").casefold()

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

        now = datetime.now(UTC)
        tarja.estado = EstadoTarja.CERRADO
        if hasattr(tarja, "updated_at"):
            tarja.updated_at = now
        session.add(tarja)
        self._cerrar_partes_confirmados_de_tarja(session, tarja, updated_at=now)

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

    @staticmethod
    def _cerrar_partes_confirmados_de_tarja(
        session: Session,
        tarja: Tarja,
        *,
        updated_at: datetime,
    ) -> None:
        stmt = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto == tarja.idproyecto)
            .where(ParteDiario.fecha >= tarja.fechainicio)
            .where(ParteDiario.fecha <= tarja.fechafinal)
            .where(ParteDiario.estado == EstadoParteDiario.CONFIRMADO)
            .where(ParteDiario.deleted_at.is_(None))
        )
        if tarja.contacto_id is None:
            stmt = stmt.where(ParteDiario.contacto_id.is_(None))
        else:
            stmt = stmt.where(ParteDiario.contacto_id == tarja.contacto_id)

        for parte in session.exec(stmt).all():
            parte.estado = EstadoParteDiario.CERRADO
            if hasattr(parte, "updated_at"):
                parte.updated_at = updated_at
            session.add(parte)

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
        tarja, _created = self.asegurar_nomina_quincena(
            session,
            idproyecto=idproyecto,
            contacto_id=contacto_id,
            fechainicio=fechainicio,
            fechafinal=fechafinal,
            auto_commit=False,
        )
        registros_vigentes = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == int(tarja.id))
            .where(TarjaNomina.fecha_desde <= fechafinal)
            .where(TarjaNomina.fecha_hasta >= fechainicio)
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if registros_vigentes is None:
            raise ValueError("No hay nomina vigente para generar la tarja")

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

        nominas_by_id: dict[int, Nomina] = {}
        for current_date in self._iter_dates(fechainicio, fechafinal):
            nominas_vigentes = self._get_nominas_vigentes_en_tarja(
                session,
                tarja_id=int(tarja.id),
                fecha=current_date,
            )
            for nomina in nominas_vigentes:
                if nomina.id is not None:
                    nominas_by_id[int(nomina.id)] = nomina
                detalle = detalles_by_fecha_nomina.get((current_date, nomina.id))
                if detalle is None and not es_dia_laborable(current_date):
                    continue
                self.agregar_tarja_detalle(
                    session,
                    tarja_id=int(tarja.id),
                    nomina_id=int(nomina.id),
                    fecha=current_date,
                    estado_id=detalle.idestado if detalle else presente.id,
                    horas=detalle.horas if detalle else get_jornada_esperada(current_date),
                    descripcion=detalle.descripcion if detalle else None,
                    parte_diario_detalle_id=(
                        int(detalle.id) if detalle and detalle.id is not None else None
                    ),
                )

        session.flush()
        self._sync_tarja_nomina(session, tarja, list(nominas_by_id.values()))
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

        nominas = self._get_nominas_vigentes_en_tarja(
            session,
            tarja_id=int(tarja.id),
            fecha=parte.fecha,
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
            self.agregar_tarja_detalle(
                session,
                tarja_id=int(tarja.id),
                nomina_id=int(detalle.idnomina),
                fecha=parte.fecha,
                estado_id=detalle_estado_id,
                horas=detalle_horas,
                descripcion=None if es_alta else detalle.descripcion,
                parte_diario_detalle_id=int(detalle.id) if detalle.id is not None else None,
                exigir_asignacion=False,
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
                parte=parte,
                baja_detalles=baja_detalles,
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
                self.agregar_tarja_detalle(
                    session,
                    tarja_id=int(tarja.id),
                    nomina_id=int(nomina.id),
                    fecha=parte.fecha,
                    estado_id=presente.id,
                    horas=get_jornada_esperada(parte.fecha),
                    descripcion=None,
                    parte_diario_detalle_id=None,
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
        parte: ParteDiario,
        baja_detalles: list[ParteDiarioDetalle],
    ) -> None:
        # La baja debe reconciliar la trayectoria completa del empleado. Limitar
        # la limpieza al tarja_id de origen deja vigentes los detalles creados por
        # un traspaso en otra obra y permite que novedades futuras los regeneren.
        for baja_detalle in baja_detalles:
            if baja_detalle.idnomina is None:
                continue
            self._aplicar_baja_nomina_futura(
                session,
                parte=parte,
                nomina_id=int(baja_detalle.idnomina),
            )

        session.flush()

    def obtener_impacto_baja(
        self,
        session: Session,
        *,
        parte: ParteDiario,
        nomina_id: int,
    ) -> dict[str, int | str | None]:
        futuros, proxima_alta = self._get_novedades_afectadas_desde(
            session,
            fecha_baja=parte.fecha,
            nomina_id=nomina_id,
        )
        traslados = sum(
            1
            for _detalle, _parte, estado in futuros
            if estado is not None
            and str(estado.abreviatura or "").strip().upper() == TRASPASO_ESTADO_CODIGO
        )
        tarja_stmt = (
            select(TarjaDetalle)
            .where(TarjaDetalle.idnomina == nomina_id)
            .where(TarjaDetalle.fecha > parte.fecha)
            .where(TarjaDetalle.deleted_at.is_(None))
        )
        if proxima_alta is not None:
            tarja_stmt = tarja_stmt.where(TarjaDetalle.fecha < proxima_alta)
        tarja_detalles = session.exec(tarja_stmt).all()
        return {
            "id": nomina_id,
            "novedades": len(futuros),
            "traslados": traslados,
            "tarja_detalles": len(tarja_detalles),
            "proxima_alta": proxima_alta.isoformat() if proxima_alta is not None else None,
        }

    def _aplicar_baja_nomina_futura(
        self,
        session: Session,
        *,
        parte: ParteDiario,
        nomina_id: int,
    ) -> None:
        _futuros, proxima_alta = self._reconciliar_trayectoria_nomina(
            session,
            fecha_corte=parte.fecha,
            nomina_id=nomina_id,
            incluir_fecha_corte=False,
            preservar_proxima_alta=True,
            baja_logica_asignaciones=False,
        )
        now = datetime.now(UTC)
        nomina = session.get(Nomina, nomina_id)
        if nomina is not None and nomina.deleted_at is None and proxima_alta is None:
            nomina.idproyecto = parte.idproyecto
            nomina.encargado_contacto_id = parte.contacto_id
            nomina.fecha_egreso = parte.fecha
            nomina.activo = False
            nomina.updated_at = now
            session.add(nomina)

    def eliminar_alta_nomina(
        self,
        session: Session,
        *,
        detalle_alta: ParteDiarioDetalle,
        registro_alta: TarjaNomina,
    ) -> None:
        """Revierte desde su fecha toda la trayectoria originada por un alta."""
        if detalle_alta.idnomina is None or registro_alta.nomina_id is None:
            return
        parte = session.get(ParteDiario, detalle_alta.parte_diario_id)
        if parte is None or parte.deleted_at is not None:
            return

        nomina_id = int(detalle_alta.idnomina)
        if nomina_id != int(registro_alta.nomina_id):
            return

        self._reconciliar_trayectoria_nomina(
            session,
            fecha_corte=parte.fecha,
            nomina_id=nomina_id,
            incluir_fecha_corte=True,
            preservar_proxima_alta=False,
            baja_logica_asignaciones=True,
        )

        nomina = session.get(Nomina, nomina_id)
        if nomina is not None and nomina.deleted_at is None:
            deleted_at = datetime.now(UTC)
            nomina.activo = False
            nomina.deleted_at = deleted_at
            nomina.updated_at = deleted_at
            session.add(nomina)

    def eliminar_traspaso_nomina(
        self,
        session: Session,
        *,
        detalle_traspaso: ParteDiarioDetalle,
    ) -> None:
        """Revierte el destino y reincorpora al empleado en la obra de origen."""
        if detalle_traspaso.idnomina is None:
            return
        parte = session.get(ParteDiario, detalle_traspaso.parte_diario_id)
        if parte is None or parte.deleted_at is not None:
            return

        payload = self._parse_traspaso_payload(detalle_traspaso)
        origen = payload.get("origen") if isinstance(payload.get("origen"), dict) else {}
        origen_proyecto_id = self._payload_int(origen.get("idproyecto")) or int(
            parte.idproyecto
        )
        origen_contacto_id = self._payload_int(origen.get("contacto_id"))
        if origen_contacto_id is None:
            origen_contacto_id = parte.contacto_id

        nomina_id = int(detalle_traspaso.idnomina)
        self._reconciliar_trayectoria_nomina(
            session,
            fecha_corte=parte.fecha,
            nomina_id=nomina_id,
            incluir_fecha_corte=True,
            preservar_proxima_alta=False,
            baja_logica_asignaciones=False,
        )

        nomina = session.get(Nomina, nomina_id)
        if nomina is None or nomina.deleted_at is not None:
            return
        nomina.idproyecto = origen_proyecto_id
        nomina.encargado_contacto_id = origen_contacto_id
        nomina.fecha_egreso = None
        nomina.activo = True
        nomina.updated_at = datetime.now(UTC)
        session.add(nomina)
        session.flush()

        partes_origen = list(
            session.exec(
                select(ParteDiario)
                .where(ParteDiario.idproyecto == origen_proyecto_id)
                .where(ParteDiario.fecha >= parte.fecha)
                .where(
                    ParteDiario.estado.in_(
                        [EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO]
                    )
                )
                .where(ParteDiario.deleted_at.is_(None))
                .where(
                    ParteDiario.contacto_id == origen_contacto_id
                    if origen_contacto_id is not None
                    else ParteDiario.contacto_id.is_(None)
                )
                .order_by(ParteDiario.fecha, ParteDiario.id)
            ).all()
        )
        if parte.id is not None and all(
            parte_origen.id != parte.id for parte_origen in partes_origen
        ):
            partes_origen.insert(0, parte)
        partes_por_quincena: dict[tuple[date, date], list[ParteDiario]] = {}
        for parte_origen in partes_origen:
            partes_por_quincena.setdefault(
                get_quincena_range(parte_origen.fecha),
                [],
            ).append(parte_origen)

        presente = self._get_estado_presente(session)
        for (quincena_inicio, quincena_final), partes in partes_por_quincena.items():
            tarja = self._find_or_create_tarja(
                session,
                idproyecto=origen_proyecto_id,
                contacto_id=origen_contacto_id,
                fechainicio=quincena_inicio,
                fechafinal=quincena_final,
            )
            registro = session.exec(
                select(TarjaNomina)
                .where(TarjaNomina.tarja_id == int(tarja.id))
                .where(TarjaNomina.nomina_id == nomina_id)
            ).first()
            fecha_desde = max(quincena_inicio, parte.fecha)
            if registro is None:
                registro = TarjaNomina(
                    tarja_id=int(tarja.id),
                    nomina_id=nomina_id,
                    nomina_categoria_id=nomina.nomina_categoria_id,
                    nomina_tarea_id=nomina.nomina_tarea_id,
                    fecha_desde=fecha_desde,
                    fecha_hasta=quincena_final,
                    documentos=[],
                )
            else:
                registro.deleted_at = None
                registro.fecha_desde = min(registro.fecha_desde, fecha_desde)
                registro.fecha_hasta = quincena_final
                registro.updated_at = datetime.now(UTC)
            session.add(registro)
            session.flush()

            parte_referencia = partes[0]
            inicio_detalle_ids = (
                {int(detalle_traspaso.id)}
                if detalle_traspaso.id is not None
                and quincena_inicio <= parte.fecha <= quincena_final
                else set()
            )
            self._sync_tarja_detalles_desde_inicio_vigencia(
                session,
                tarja=tarja,
                parte=parte_referencia,
                nomina_ids={nomina_id},
                inicio_detalle_ids=inicio_detalle_ids,
                quincena_inicio=quincena_inicio,
                quincena_final=quincena_final,
                presente_id=int(presente.id),
            )

        session.flush()

    def _reconciliar_trayectoria_nomina(
        self,
        session: Session,
        *,
        fecha_corte: date,
        nomina_id: int,
        incluir_fecha_corte: bool,
        preservar_proxima_alta: bool,
        baja_logica_asignaciones: bool,
    ) -> tuple[
        list[tuple[ParteDiarioDetalle, ParteDiario, ParteDiarioEstado | None]],
        date | None,
    ]:
        """Limpia novedades, tarjas y asignaciones posteriores a un corte."""
        futuros, proxima_alta = self._get_novedades_afectadas_desde(
            session,
            fecha_baja=fecha_corte,
            nomina_id=nomina_id,
            preservar_proxima_alta=preservar_proxima_alta,
        )
        now = datetime.now(UTC)

        tarja_stmt = (
            select(TarjaDetalle)
            .where(TarjaDetalle.idnomina == nomina_id)
            .where(TarjaDetalle.deleted_at.is_(None))
        )
        if incluir_fecha_corte:
            tarja_stmt = tarja_stmt.where(TarjaDetalle.fecha >= fecha_corte)
        else:
            tarja_stmt = tarja_stmt.where(TarjaDetalle.fecha > fecha_corte)
        if proxima_alta is not None:
            tarja_stmt = tarja_stmt.where(TarjaDetalle.fecha < proxima_alta)
        for tarja_detalle in session.exec(tarja_stmt).all():
            if baja_logica_asignaciones:
                tarja_detalle.parte_diario_detalle_id = None
                tarja_detalle.deleted_at = now
                tarja_detalle.updated_at = now
                session.add(tarja_detalle)
            else:
                session.delete(tarja_detalle)
        session.flush()

        # Se eliminan las novedades fuente para que una sincronizacion posterior
        # de sus partes confirmados no vuelva a crear los detalles anulados.
        for future_detalle, _future_parte, _estado in futuros:
            session.delete(future_detalle)
        session.flush()

        registros = session.exec(
            select(TarjaNomina)
            .where(TarjaNomina.nomina_id == nomina_id)
            .where(TarjaNomina.deleted_at.is_(None))
        ).all()
        for registro in registros:
            inicia_despues = registro.fecha_desde > fecha_corte
            inicia_en_corte = incluir_fecha_corte and registro.fecha_desde == fecha_corte
            dentro_del_limite = proxima_alta is None or registro.fecha_desde < proxima_alta
            if (inicia_despues or inicia_en_corte) and dentro_del_limite:
                if baja_logica_asignaciones:
                    registro.deleted_at = now
                    registro.updated_at = now
                    session.add(registro)
                else:
                    session.delete(registro)
                continue

            if incluir_fecha_corte:
                contiene_corte = registro.fecha_desde < fecha_corte <= registro.fecha_hasta
                nueva_fecha_hasta = fecha_corte - timedelta(days=1)
            else:
                contiene_corte = registro.fecha_desde <= fecha_corte < registro.fecha_hasta
                nueva_fecha_hasta = fecha_corte
            if contiene_corte:
                registro.fecha_hasta = nueva_fecha_hasta
                registro.updated_at = now
                session.add(registro)

        session.flush()
        return futuros, proxima_alta

    def _get_novedades_afectadas_desde(
        self,
        session: Session,
        *,
        fecha_baja: date,
        nomina_id: int,
        preservar_proxima_alta: bool = True,
    ) -> tuple[
        list[tuple[ParteDiarioDetalle, ParteDiario, ParteDiarioEstado | None]],
        date | None,
    ]:
        rows = list(
            session.exec(
                select(ParteDiarioDetalle, ParteDiario, ParteDiarioEstado)
                .join(ParteDiario, ParteDiario.id == ParteDiarioDetalle.parte_diario_id)
                .outerjoin(ParteDiarioEstado, ParteDiarioEstado.id == ParteDiarioDetalle.idestado)
                .where(ParteDiarioDetalle.idnomina == nomina_id)
                .where(ParteDiarioDetalle.deleted_at.is_(None))
                .where(ParteDiario.deleted_at.is_(None))
                .where(ParteDiario.fecha > fecha_baja)
                .order_by(ParteDiario.fecha, ParteDiarioDetalle.id)
            ).all()
        )
        proxima_alta = (
            next(
                (
                    future_parte.fecha
                    for _detalle, future_parte, estado in rows
                    if future_parte.estado in {
                        EstadoParteDiario.CONFIRMADO,
                        EstadoParteDiario.CERRADO,
                    }
                    and estado is not None
                    and str(estado.abreviatura or "").strip().upper()
                    == ALTA_ESTADO_CODIGO
                ),
                None,
            )
            if preservar_proxima_alta
            else None
        )
        afectados = [
            row
            for row in rows
            if proxima_alta is None or row[1].fecha < proxima_alta
        ]
        return afectados, proxima_alta

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
            # La tarja destino puede nacer a partir del traspaso. Inicializar su
            # nomina antes de mover al empleado evita que el registro trasladado
            # sea interpretado luego como una nomina de quincena ya completa.
            self.asegurar_nomina_quincena(
                session,
                idproyecto=destino_proyecto_id,
                contacto_id=destino_contacto_id,
                fechainicio=source_tarja.fechainicio,
                fechafinal=source_tarja.fechafinal,
                auto_commit=False,
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
            self.agregar_tarja_detalle(
                session,
                tarja_id=destination_tarja_id,
                nomina_id=nomina_id,
                fecha=fecha,
                estado_id=presente_id,
                horas=get_jornada_esperada(fecha),
                descripcion=descripcion,
                parte_diario_detalle_id=parte_diario_detalle_id,
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
        alta_nomina_ids = {
            int(detalle.idnomina)
            for detalle in alta_detalles
            if detalle.idnomina is not None
        }
        if not alta_nomina_ids:
            return
        alta_detalle_ids = {
            int(detalle.id)
            for detalle in alta_detalles
            if detalle.id is not None
        }
        self._sync_tarja_detalles_desde_inicio_vigencia(
            session,
            tarja=tarja,
            parte=parte,
            nomina_ids=alta_nomina_ids,
            inicio_detalle_ids=alta_detalle_ids,
            quincena_inicio=quincena_inicio,
            quincena_final=quincena_final,
            presente_id=presente_id,
        )

    def _sync_tarja_detalles_desde_inicio_vigencia(
        self,
        session: Session,
        *,
        tarja: Tarja,
        parte: ParteDiario,
        nomina_ids: set[int],
        inicio_detalle_ids: set[int],
        quincena_inicio: date,
        quincena_final: date,
        presente_id: int,
    ) -> None:
        """Reconstruye una tarja desde un alta o una reincorporacion retroactiva."""
        if not nomina_ids:
            return
        tarja_id = int(tarja.id)

        for detalle in session.exec(
            select(TarjaDetalle)
            .where(TarjaDetalle.tarja_id == tarja_id)
            .where(TarjaDetalle.idnomina.in_(nomina_ids))
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
            .where(ParteDiarioDetalle.idnomina.in_(nomina_ids))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        inicio_detalle_ids = inicio_detalle_ids | {
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
                .where(TarjaDetalle.idnomina.in_(nomina_ids))
                .where(TarjaDetalle.fecha >= parte.fecha)
                .where(TarjaDetalle.fecha <= quincena_final)
                .where(TarjaDetalle.deleted_at.is_(None))
            ).all()
            if detalle.idnomina is not None
        }

        for confirmed_parte in partes_confirmados:
            for nomina_id in nomina_ids:
                key = (confirmed_parte.fecha, nomina_id)
                if key in existing_keys:
                    continue
                detalle = detalles_by_parte_nomina.get((int(confirmed_parte.id), nomina_id))
                if detalle is None and not es_dia_laborable(confirmed_parte.fecha):
                    continue
                es_inicio = (
                    detalle is not None
                    and detalle.id is not None
                    and int(detalle.id) in inicio_detalle_ids
                )
                detalle_estado_id = presente_id
                detalle_horas = get_jornada_esperada(confirmed_parte.fecha)
                detalle_descripcion = None
                if detalle is not None and not es_inicio:
                    detalle_estado_id = detalle.idestado
                    detalle_horas = detalle.horas
                    detalle_descripcion = detalle.descripcion
                self.agregar_tarja_detalle(
                    session,
                    tarja_id=tarja_id,
                    nomina_id=nomina_id,
                    fecha=confirmed_parte.fecha,
                    estado_id=detalle_estado_id,
                    horas=detalle_horas,
                    descripcion=detalle_descripcion,
                    parte_diario_detalle_id=(
                        int(detalle.id) if detalle and detalle.id is not None else None
                    ),
                )
                existing_keys.add(key)

    def agregar_tarja_detalle(
        self,
        session: Session,
        *,
        tarja_id: int,
        nomina_id: int,
        fecha: date,
        estado_id: int | None,
        horas: Decimal,
        descripcion: str | None,
        parte_diario_detalle_id: int | None,
        exigir_asignacion: bool = True,
    ) -> TarjaDetalle | None:
        """Unico punto de alta de detalles, con vigencia validada por fecha."""
        nomina = session.get(Nomina, nomina_id)
        if nomina is None or nomina.deleted_at is not None:
            return None
        if exigir_asignacion:
            if not self._nomina_asignada_a_tarja_en_fecha(
                session,
                tarja_id=tarja_id,
                nomina=nomina,
                fecha=fecha,
            ):
                return None
        elif not self._nomina_vigente_en_alguna_tarja(
            session,
            nomina=nomina,
            fecha=fecha,
        ):
            return None

        detalle = TarjaDetalle(
            tarja_id=tarja_id,
            idnomina=nomina_id,
            fecha=fecha,
            idestado=estado_id,
            horas=horas,
            descripcion=descripcion,
            parte_diario_detalle_id=parte_diario_detalle_id,
        )
        session.add(detalle)
        return detalle

    def _nomina_asignada_a_tarja_en_fecha(
        self,
        session: Session,
        *,
        tarja_id: int,
        nomina: Nomina,
        fecha: date,
    ) -> bool:
        registro_vigente = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == tarja_id)
            .where(TarjaNomina.nomina_id == nomina.id)
            .where(TarjaNomina.fecha_desde <= fecha)
            .where(TarjaNomina.fecha_hasta >= fecha)
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if registro_vigente is not None:
            return True

        # Las tarjas antiguas pueden no tener aun registros de TarjaNomina. El
        # fallback solo se admite cuando la tarja completa carece de ese padrón;
        # si existe, sus rangos son la fuente de verdad.
        tiene_padron = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == tarja_id)
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if tiene_padron is not None:
            return False

        tarja = session.get(Tarja, tarja_id)
        if tarja is None or tarja.deleted_at is not None or not nomina.activo:
            return False
        if nomina.fecha_ingreso is not None and fecha < nomina.fecha_ingreso:
            return False
        if nomina.fecha_egreso is not None and fecha > nomina.fecha_egreso:
            return False
        return (
            nomina.idproyecto == tarja.idproyecto
            and nomina.encargado_contacto_id == tarja.contacto_id
        )

    def _nomina_vigente_en_alguna_tarja(
        self,
        session: Session,
        *,
        nomina: Nomina,
        fecha: date,
    ) -> bool:
        registro_vigente = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.nomina_id == nomina.id)
            .where(TarjaNomina.fecha_desde <= fecha)
            .where(TarjaNomina.fecha_hasta >= fecha)
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if registro_vigente is not None:
            return True

        tiene_historial = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.nomina_id == nomina.id)
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if tiene_historial is not None:
            return False
        if nomina.fecha_ingreso is not None and fecha < nomina.fecha_ingreso:
            return False
        if nomina.fecha_egreso is not None and fecha > nomina.fecha_egreso:
            return False
        return nomina.activo

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

    def _get_nominas_vigentes_en_tarja(
        self,
        session: Session,
        *,
        tarja_id: int,
        fecha: date,
    ) -> list[Nomina]:
        return list(
            session.exec(
                select(Nomina)
                .join(TarjaNomina, TarjaNomina.nomina_id == Nomina.id)
                .where(TarjaNomina.tarja_id == tarja_id)
                .where(TarjaNomina.fecha_desde <= fecha)
                .where(TarjaNomina.fecha_hasta >= fecha)
                .where(TarjaNomina.deleted_at.is_(None))
                .where(Nomina.deleted_at.is_(None))
                .order_by(Nomina.apellido, Nomina.nombre)
            ).all()
        )

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
                viaticos=self.get_viaticos_default(session, idproyecto),
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
            viaticos=self.get_viaticos_default(session, idproyecto),
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
