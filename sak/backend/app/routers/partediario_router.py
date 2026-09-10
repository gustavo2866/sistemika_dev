from datetime import UTC, date, datetime
import json
from typing import Any

from sqlalchemy import func

from app.core.nested_crud import NestedCRUD
from app.models.base import filtrar_respuesta
from app.core.router import create_generic_router
from app.db import get_session
from app.models.nomina import Nomina
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import EstadoParteDiario, ParteDiario, ParteDiarioDetalle
from app.models.proyecto_encargado import ProyectoEncargado
from app.models.tarja import Tarja, TarjaDetalle, TarjaNomina
from app.services.parte_diario_tarja_service import (
    get_jornada_esperada,
    get_quincena_range,
    parte_diario_tarja_service,
)
from agente.v3.subprocesses.parte_diario.calendario import es_dia_laborable
from fastapi import Depends, HTTPException, Query
from sqlmodel import Session, select

# Define NestedCRUD for ParteDiario with its nested detalles

class ParteDiarioCRUD(NestedCRUD):
    ALTA_ESTADO_CODIGO = "ALT"
    BAJA_ESTADO_CODIGO = "BAJ"
    TRASPASO_ESTADO_CODIGO = "TRA"

    @staticmethod
    def _delete_detalle(
        session: Session,
        detalle: ParteDiarioDetalle,
    ) -> None:
        ParteDiarioCRUD._delete_alta_nomina_if_needed(session, detalle)
        ParteDiarioCRUD._restore_baja_nomina_if_needed(session, detalle)
        ParteDiarioCRUD._restore_traspaso_nomina_if_needed(session, detalle)
        if detalle.id is not None:
            tarja_detalles = session.exec(
                select(TarjaDetalle)
                .where(TarjaDetalle.parte_diario_detalle_id == int(detalle.id))
            ).all()
            for tarja_detalle in tarja_detalles:
                tarja_detalle.parte_diario_detalle_id = None
                session.add(tarja_detalle)
        session.delete(detalle)

    @staticmethod
    def _delete_alta_nomina_if_needed(
        session: Session,
        detalle: ParteDiarioDetalle,
    ) -> None:
        if detalle.idestado is None:
            return
        estado = session.get(ParteDiarioEstado, detalle.idestado)
        if (
            estado is None
            or estado.deleted_at is not None
            or str(estado.abreviatura or "").strip().upper()
            != ParteDiarioCRUD.ALTA_ESTADO_CODIGO
        ):
            return

        tarja_nomina_id = str(detalle.descripcion or "").strip()
        if not tarja_nomina_id.isdigit():
            return
        registro = session.get(TarjaNomina, int(tarja_nomina_id))
        if registro is None or registro.deleted_at is not None:
            return

        tarja = session.get(Tarja, registro.tarja_id)
        nomina_id = int(registro.nomina_id) if registro.nomina_id is not None else None
        if tarja is None or nomina_id is None:
            return

        deleted_at = datetime.now(UTC)
        for tarja_detalle in session.exec(
            select(TarjaDetalle)
            .where(TarjaDetalle.tarja_id == registro.tarja_id)
            .where(TarjaDetalle.idnomina == nomina_id)
            .where(TarjaDetalle.fecha >= tarja.fechainicio)
            .where(TarjaDetalle.fecha <= tarja.fechafinal)
            .where(TarjaDetalle.deleted_at.is_(None))
        ).all():
            tarja_detalle.parte_diario_detalle_id = None
            tarja_detalle.deleted_at = deleted_at
            tarja_detalle.updated_at = deleted_at
            session.add(tarja_detalle)

        registro.deleted_at = deleted_at
        registro.updated_at = deleted_at
        session.add(registro)

        other_nomina_count = session.exec(
            select(func.count())
            .select_from(TarjaNomina)
            .where(TarjaNomina.nomina_id == nomina_id)
            .where(TarjaNomina.id != registro.id)
            .where(TarjaNomina.deleted_at.is_(None))
        ).one()
        if int(other_nomina_count or 0) != 0:
            return

        nomina = session.get(Nomina, nomina_id)
        if nomina is not None and nomina.deleted_at is None:
            nomina.activo = False
            nomina.deleted_at = deleted_at
            nomina.updated_at = deleted_at
            session.add(nomina)

    @staticmethod
    def _restore_traspaso_nomina_if_needed(
        session: Session,
        detalle: ParteDiarioDetalle,
    ) -> None:
        if detalle.idestado is None or detalle.idnomina is None:
            return
        estado = session.get(ParteDiarioEstado, detalle.idestado)
        if (
            estado is None
            or estado.deleted_at is not None
            or str(estado.abreviatura or "").strip().upper()
            != ParteDiarioCRUD.TRASPASO_ESTADO_CODIGO
        ):
            return

        parte = session.get(ParteDiario, detalle.parte_diario_id)
        if parte is None or parte.deleted_at is not None:
            return
        payload = ParteDiarioCRUD._parse_detalle_json(detalle.descripcion)
        origen = payload.get("origen") if isinstance(payload.get("origen"), dict) else {}
        destino = payload.get("destino") if isinstance(payload.get("destino"), dict) else {}
        origen_proyecto_id = ParteDiarioCRUD._payload_int(origen.get("idproyecto")) or int(parte.idproyecto)
        origen_contacto_id = ParteDiarioCRUD._payload_int(origen.get("contacto_id"))
        if origen_contacto_id is None:
            origen_contacto_id = parte.contacto_id
        destino_proyecto_id = ParteDiarioCRUD._payload_int(destino.get("idproyecto"))
        destino_contacto_id = ParteDiarioCRUD._payload_int(destino.get("contacto_id"))

        quincena_inicio, quincena_final = get_quincena_range(parte.fecha)
        source_tarja = ParteDiarioCRUD._get_tarja_quincena(
            session,
            idproyecto=origen_proyecto_id,
            contacto_id=origen_contacto_id,
            fechainicio=quincena_inicio,
            fechafinal=quincena_final,
        )
        nomina_id = int(detalle.idnomina)
        now = datetime.now(UTC)

        if destino_proyecto_id is not None:
            destination_tarja = ParteDiarioCRUD._get_tarja_quincena(
                session,
                idproyecto=destino_proyecto_id,
                contacto_id=destino_contacto_id,
                fechainicio=quincena_inicio,
                fechafinal=quincena_final,
            )
            if destination_tarja is not None and destination_tarja.id is not None:
                for destination_detalle in session.exec(
                    select(TarjaDetalle)
                    .where(TarjaDetalle.tarja_id == int(destination_tarja.id))
                    .where(TarjaDetalle.idnomina == nomina_id)
                    .where(TarjaDetalle.fecha >= parte.fecha)
                    .where(TarjaDetalle.fecha <= quincena_final)
                    .where(TarjaDetalle.parte_diario_detalle_id == detalle.id)
                ).all():
                    session.delete(destination_detalle)
                for destination_registro in session.exec(
                    select(TarjaNomina)
                    .where(TarjaNomina.tarja_id == int(destination_tarja.id))
                    .where(TarjaNomina.nomina_id == nomina_id)
                    .where(TarjaNomina.fecha_desde == parte.fecha)
                    .where(TarjaNomina.deleted_at.is_(None))
                ).all():
                    session.delete(destination_registro)

        if source_tarja is not None and source_tarja.id is not None:
            for source_registro in session.exec(
                select(TarjaNomina)
                .where(TarjaNomina.tarja_id == int(source_tarja.id))
                .where(TarjaNomina.nomina_id == nomina_id)
                .where(TarjaNomina.deleted_at.is_(None))
            ).all():
                source_registro.fecha_hasta = source_tarja.fechafinal
                if hasattr(source_registro, "updated_at"):
                    source_registro.updated_at = now
                session.add(source_registro)
            ParteDiarioCRUD._restaurar_tarja_detalles_post_baja(
                session,
                tarja=source_tarja,
                parte=parte,
                nomina_id=nomina_id,
                quincena_final=quincena_final,
            )

        nomina = session.get(Nomina, nomina_id)
        if nomina is not None and nomina.deleted_at is None:
            nomina.idproyecto = origen_proyecto_id
            nomina.encargado_contacto_id = origen_contacto_id
            nomina.activo = True
            nomina.fecha_egreso = None
            if hasattr(nomina, "updated_at"):
                nomina.updated_at = now
            session.add(nomina)

    @staticmethod
    def _restore_baja_nomina_if_needed(
        session: Session,
        detalle: ParteDiarioDetalle,
    ) -> None:
        if detalle.idestado is None or detalle.idnomina is None:
            return
        estado = session.get(ParteDiarioEstado, detalle.idestado)
        if (
            estado is None
            or estado.deleted_at is not None
            or str(estado.abreviatura or "").strip().upper()
            != ParteDiarioCRUD.BAJA_ESTADO_CODIGO
        ):
            return

        parte = session.get(ParteDiario, detalle.parte_diario_id)
        if parte is None or parte.deleted_at is not None:
            return
        quincena_inicio, quincena_final = get_quincena_range(parte.fecha)
        tarja = ParteDiarioCRUD._get_tarja_quincena(
            session,
            idproyecto=int(parte.idproyecto),
            contacto_id=parte.contacto_id,
            fechainicio=quincena_inicio,
            fechafinal=quincena_final,
        )
        if tarja is None or tarja.id is None:
            return

        nomina_id = int(detalle.idnomina)
        now = datetime.now(UTC)
        nomina = session.get(Nomina, nomina_id)
        if nomina is not None and nomina.deleted_at is None:
            if nomina.fecha_egreso == parte.fecha:
                nomina.fecha_egreso = None
            nomina.activo = True
            if hasattr(nomina, "updated_at"):
                nomina.updated_at = now
            session.add(nomina)

        registros = session.exec(
            select(TarjaNomina)
            .where(TarjaNomina.tarja_id == int(tarja.id))
            .where(TarjaNomina.nomina_id == nomina_id)
            .where(TarjaNomina.deleted_at.is_(None))
        ).all()
        for registro in registros:
            if registro.fecha_hasta is None or registro.fecha_hasta <= parte.fecha:
                registro.fecha_hasta = tarja.fechafinal
                if hasattr(registro, "updated_at"):
                    registro.updated_at = now
                session.add(registro)

        ParteDiarioCRUD._restaurar_tarja_detalles_post_baja(
            session,
            tarja=tarja,
            parte=parte,
            nomina_id=nomina_id,
            quincena_final=quincena_final,
        )

    @staticmethod
    def _get_tarja_quincena(
        session: Session,
        *,
        idproyecto: int,
        contacto_id: int | None,
        fechainicio: date,
        fechafinal: date,
    ) -> Tarja | None:
        stmt = (
            select(Tarja)
            .where(Tarja.idproyecto == idproyecto)
            .where(Tarja.fechainicio == fechainicio)
            .where(Tarja.fechafinal == fechafinal)
            .where(Tarja.deleted_at.is_(None))
        )
        if contacto_id is None:
            stmt = stmt.where(Tarja.contacto_id.is_(None))
        else:
            stmt = stmt.where(Tarja.contacto_id == contacto_id)
        return session.exec(stmt).first()

    @staticmethod
    def _restaurar_tarja_detalles_post_baja(
        session: Session,
        *,
        tarja: Tarja,
        parte: ParteDiario,
        nomina_id: int,
        quincena_final: date,
    ) -> None:
        presente = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.abreviatura == "P")
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).first()
        if presente is None or tarja.id is None:
            return

        partes_futuros = session.exec(
            select(ParteDiario)
            .where(ParteDiario.idproyecto == parte.idproyecto)
            .where(ParteDiario.fecha > parte.fecha)
            .where(ParteDiario.fecha <= quincena_final)
            .where(ParteDiario.estado.in_([EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO]))
            .where(ParteDiario.deleted_at.is_(None))
            .where(
                ParteDiario.contacto_id == parte.contacto_id
                if parte.contacto_id is not None
                else ParteDiario.contacto_id.is_(None)
            )
        ).all()
        detalles_by_parte = {
            int(future.id): None
            for future in partes_futuros
            if future.id is not None
        }
        if detalles_by_parte:
            for future_detalle in session.exec(
                select(ParteDiarioDetalle)
                .where(ParteDiarioDetalle.parte_diario_id.in_(detalles_by_parte.keys()))
                .where(ParteDiarioDetalle.idnomina == nomina_id)
                .where(ParteDiarioDetalle.deleted_at.is_(None))
            ).all():
                if future_detalle.parte_diario_id is not None:
                    detalles_by_parte[int(future_detalle.parte_diario_id)] = future_detalle

        existing_dates = {
            detalle.fecha
            for detalle in session.exec(
                select(TarjaDetalle)
                .where(TarjaDetalle.tarja_id == int(tarja.id))
                .where(TarjaDetalle.idnomina == nomina_id)
                .where(TarjaDetalle.fecha > parte.fecha)
                .where(TarjaDetalle.fecha <= quincena_final)
                .where(TarjaDetalle.deleted_at.is_(None))
            ).all()
        }

        for future_parte in partes_futuros:
            current = future_parte.fecha
            if current in existing_dates or future_parte.id is None:
                continue
            future_detalle = (
                detalles_by_parte.get(int(future_parte.id))
            )
            if future_detalle is None and not es_dia_laborable(current):
                continue
            session.add(
                TarjaDetalle(
                    tarja_id=int(tarja.id),
                    idnomina=nomina_id,
                    fecha=current,
                    idestado=(
                        future_detalle.idestado
                        if future_detalle is not None
                        else presente.id
                    ),
                    horas=(
                        future_detalle.horas
                        if future_detalle is not None
                        else get_jornada_esperada(current)
                    ),
                    descripcion=(
                        future_detalle.descripcion
                        if future_detalle is not None
                        else None
                    ),
                    parte_diario_detalle_id=(
                        int(future_detalle.id)
                        if future_detalle is not None and future_detalle.id is not None
                        else None
                    ),
                )
            )

    @staticmethod
    def _asegurar_tarja_borrador(
        session: Session,
        data: dict[str, Any],
        *,
        existing: ParteDiario | None = None,
    ) -> None:
        estado = data.get("estado", existing.estado if existing is not None else EstadoParteDiario.BORRADOR)
        if estado != EstadoParteDiario.BORRADOR:
            return
        idproyecto = data.get("idproyecto", existing.idproyecto if existing is not None else None)
        fecha_value = data.get("fecha", existing.fecha if existing is not None else None)
        if idproyecto in (None, "") or fecha_value in (None, ""):
            return
        fecha = (
            date.fromisoformat(fecha_value)
            if isinstance(fecha_value, str)
            else fecha_value
        )
        if not isinstance(fecha, date):
            return
        fechainicio, fechafinal = get_quincena_range(fecha)
        contacto_value = data.get("contacto_id", existing.contacto_id if existing is not None else None)
        parte_diario_tarja_service.asegurar_tarja_borrador_quincena(
            session,
            idproyecto=int(idproyecto),
            contacto_id=(
                int(contacto_value) if contacto_value not in (None, "") else None
            ),
            fechainicio=fechainicio,
            fechafinal=fechafinal,
            auto_commit=False,
        )

    def _validate_nomina_detalles(
        self,
        session: Session,
        data: dict[str, Any],
        *,
        existing: ParteDiario | None = None,
    ) -> None:
        detalles = data.get("detalles")
        if not isinstance(detalles, list):
            return

        self._validate_detalles_nomina_unicos(data, existing=existing)

        nomina_ids = {
            int(detalle["idnomina"])
            for detalle in detalles
            if isinstance(detalle, dict) and detalle.get("idnomina") not in (None, "")
        }
        if not nomina_ids:
            return

        baja_estado_ids = self._get_estado_ids_por_codigo(
            session,
            detalles,
            self.BAJA_ESTADO_CODIGO,
        )
        baja_nomina_ids = {
            int(detalle["idnomina"])
            for detalle in detalles
            if (
                isinstance(detalle, dict)
                and detalle.get("idnomina") not in (None, "")
                and detalle.get("idestado") not in (None, "")
                and int(detalle["idestado"]) in baja_estado_ids
            )
        }
        active_nomina_ids = nomina_ids - baja_nomina_ids
        valid_ids: set[int] = set()

        if active_nomina_ids:
            stmt = (
                select(Nomina.id)
                .where(Nomina.id.in_(active_nomina_ids))
                .where(Nomina.activo.is_(True))
                .where(Nomina.deleted_at.is_(None))
            )
            valid_ids.update(int(nomina_id) for nomina_id in session.exec(stmt).all())

        if baja_nomina_ids:
            baja_stmt = (
                select(Nomina.id)
                .where(Nomina.id.in_(baja_nomina_ids))
                .where(Nomina.deleted_at.is_(None))
            )
            valid_ids.update(int(nomina_id) for nomina_id in session.exec(baja_stmt).all())

        invalid_ids = sorted(nomina_ids - valid_ids)
        if invalid_ids:
            raise ValueError(
                "La nomina seleccionada no existe o no esta activa: "
                + ", ".join(str(nomina_id) for nomina_id in invalid_ids)
            )

    def _validate_detalles_nomina_unicos(
        self,
        data: dict[str, Any],
        *,
        existing: ParteDiario | None = None,
    ) -> None:
        detalles = data.get("detalles")
        if not isinstance(detalles, list):
            return

        seen: dict[int, int | None] = {}
        incoming_ids: set[int] = set()
        for detalle in detalles:
            if not isinstance(detalle, dict) or detalle.get("idnomina") in (None, ""):
                continue
            nomina_id = int(detalle["idnomina"])
            detalle_id = self._payload_int(detalle.get("id"))
            if detalle_id is not None:
                incoming_ids.add(detalle_id)
            if nomina_id in seen:
                raise ValueError(
                    f"El empleado ya tiene una novedad cargada en este parte diario: {nomina_id}"
                )
            seen[nomina_id] = detalle_id

        if existing is None or not seen:
            return

        for detalle_existente in existing.detalles or []:
            if (
                detalle_existente.id is None
                or detalle_existente.idnomina is None
                or detalle_existente.deleted_at is not None
                or int(detalle_existente.id) in incoming_ids
            ):
                continue
            if int(detalle_existente.idnomina) in seen:
                raise ValueError(
                    "El empleado ya tiene una novedad cargada en este parte diario. "
                    "Edita o elimina la novedad existente antes de agregar otra."
                )

    def _get_estado_ids_por_codigo(
        self,
        session: Session,
        detalles: list[Any],
        codigo: str,
    ) -> set[int]:
        estado_ids = {
            int(detalle["idestado"])
            for detalle in detalles
            if isinstance(detalle, dict) and detalle.get("idestado") not in (None, "")
        }
        if not estado_ids:
            return set()

        return {
            int(estado.id)
            for estado in session.exec(
                select(ParteDiarioEstado)
                .where(ParteDiarioEstado.id.in_(estado_ids))
                .where(ParteDiarioEstado.deleted_at.is_(None))
            ).all()
            if str(estado.abreviatura or "").strip().upper() == codigo
        }

    def _normalizar_detalles_baja(
        self,
        session: Session,
        data: dict[str, Any],
        *,
        existing: ParteDiario | None = None,
    ) -> None:
        detalles = data.get("detalles")
        if not isinstance(detalles, list):
            return

        baja_estado_ids = self._get_estado_ids_por_codigo(
            session,
            detalles,
            self.BAJA_ESTADO_CODIGO,
        )
        if baja_estado_ids:
            for detalle in detalles:
                if not isinstance(detalle, dict) or detalle.get("idestado") in (None, ""):
                    continue
                if int(detalle["idestado"]) in baja_estado_ids:
                    detalle["horas"] = 0

        traspaso_estado_ids = self._get_estado_ids_por_codigo(
            session,
            detalles,
            self.TRASPASO_ESTADO_CODIGO,
        )
        if not traspaso_estado_ids:
            return

        for detalle in detalles:
            if not isinstance(detalle, dict) or detalle.get("idestado") in (None, ""):
                continue
            if int(detalle["idestado"]) in traspaso_estado_ids:
                detalle["horas"] = 0
                self._validate_traspaso_payload(session, detalle, data, existing=existing)

    def _validate_traspaso_payload(
        self,
        session: Session,
        detalle: dict[str, Any],
        data: dict[str, Any],
        *,
        existing: ParteDiario | None = None,
    ) -> None:
        payload = self._parse_detalle_json(str(detalle.get("descripcion") or ""))
        destino = payload.get("destino") if isinstance(payload.get("destino"), dict) else {}
        destino_proyecto_id = self._payload_int(destino.get("idproyecto"))
        destino_contacto_id = self._payload_int(destino.get("contacto_id"))
        if destino_proyecto_id is None or destino_contacto_id is None:
            raise ValueError("El traspaso requiere obra y encargado destino")
        idproyecto = data.get("idproyecto", existing.idproyecto if existing is not None else None)
        contacto_id = data.get("contacto_id", existing.contacto_id if existing is not None else None)
        origen_proyecto_id = self._payload_int(idproyecto)
        origen_contacto_id = self._payload_int(contacto_id)
        if destino_proyecto_id == origen_proyecto_id and destino_contacto_id == origen_contacto_id:
            raise ValueError("La obra y encargado destino deben ser diferentes al origen")
        asignacion = session.exec(
            select(ProyectoEncargado)
            .where(ProyectoEncargado.proyecto_id == destino_proyecto_id)
            .where(ProyectoEncargado.contacto_id == destino_contacto_id)
            .where(ProyectoEncargado.activo.is_(True))
            .where(ProyectoEncargado.deleted_at.is_(None))
        ).first()
        if asignacion is None:
            raise ValueError("El encargado no esta habilitado para la obra destino")

    @staticmethod
    def _parse_detalle_json(value: str | None) -> dict[str, Any]:
        try:
            parsed = json.loads(value or "{}")
        except (TypeError, ValueError):
            return {}
        return parsed if isinstance(parsed, dict) else {}

    @staticmethod
    def _payload_int(value: Any) -> int | None:
        if value in (None, ""):
            return None
        try:
            result = int(value)
        except (TypeError, ValueError):
            return None
        return result if result > 0 else None

    def create(self, session: Session, data: dict[str, Any]):
        self._normalizar_detalles_baja(session, data)
        self._validate_nomina_detalles(session, data)
        self._asegurar_tarja_borrador(session, data)
        parte = super().create(session, data)
        if parte.estado == EstadoParteDiario.CONFIRMADO:
            parte_diario_tarja_service.sincronizar_detalle_para_parte(session, parte)
            session.refresh(parte)
        return parte

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: dict[str, Any],
        check_version: bool = True,
    ):
        existing = session.get(ParteDiario, obj_id)
        self._normalizar_detalles_baja(session, data, existing=existing)
        self._validate_nomina_detalles(session, data, existing=existing)
        self._asegurar_tarja_borrador(session, data, existing=existing)
        parte = super().update(session, obj_id, data, check_version=check_version)
        if parte and parte.estado == EstadoParteDiario.CONFIRMADO:
            parte_diario_tarja_service.sincronizar_detalle_para_parte(session, parte)
            session.refresh(parte)
        return parte


parte_diario_crud = ParteDiarioCRUD(
    ParteDiario,
    nested_relations={
        "detalles": {
            "model": ParteDiarioDetalle,
            "fk_field": "parte_diario_id",
            "allow_delete": True,
            "delete_handler": ParteDiarioCRUD._delete_detalle,
        }
    },
)

parte_diario_router = create_generic_router(
    model=ParteDiario,
    crud=parte_diario_crud,
    prefix="/parte-diario",
    tags=["parte-diario"],
)


@parte_diario_router.get("/detalles-nomina")
def get_detalles_nomina_proyecto(
    idproyecto: int = Query(..., gt=0),
    contacto_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_session),
):
    stmt = (
        select(Nomina)
        .where(
            Nomina.idproyecto == idproyecto,
            Nomina.activo.is_(True),
            Nomina.deleted_at.is_(None),
        )
        .order_by(Nomina.apellido, Nomina.nombre)
    )
    if contacto_id is not None:
        stmt = stmt.where(Nomina.encargado_contacto_id == contacto_id)

    empleados = session.exec(stmt).all()

    return {
        "data": [
            {
                "idnomina": empleado.id,
                "nombre_provisorio": None,
                "horas": 8,
                "idestado": None,
                "ingreso": None,
                "egreso": None,
                "descripcion": None,
                "nomina": {
                    "id": empleado.id,
                    "nombre": empleado.nombre,
                    "apellido": empleado.apellido,
                    "dni": empleado.dni,
                },
            }
            for empleado in empleados
        ],
        "total": len(empleados),
    }


@parte_diario_router.post("/{parte_id}/abrir")
def abrir_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        parte = parte_diario_tarja_service.abrir_parte(session, parte_id)
        return filtrar_respuesta(parte)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.post("/{parte_id}/confirmar")
def confirmar_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        parte = parte_diario_tarja_service.confirmar_parte(session, parte_id)
        return filtrar_respuesta(parte)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.post("/{parte_id}/cerrar")
def cerrar_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.cerrar_parte(session, parte_id)
        return filtrar_respuesta(tarja)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.post("/{parte_id}/registrar-tarja")
def registrar_tarja_desde_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.registrar_tarja(session, parte_id)
        return filtrar_respuesta(tarja)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.get("/{parte_id}/tarja")
def get_tarja_de_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.get_tarja_para_parte(session, parte_id)
        return {
            "exists": tarja is not None,
            "tarja_id": tarja.id if tarja is not None else None,
            "estado": tarja.estado if tarja is not None else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
