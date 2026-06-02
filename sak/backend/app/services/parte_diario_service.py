"""Materializacion transaccional de partes diarios confirmados por el agente."""

from __future__ import annotations

import copy
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.models import (
    CRMMensaje,
    EstadoParteDiario,
    Nomina,
    OrigenDetalle,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
)


class ParteDiarioService:
    def create_or_update_from_agent_message(self, session: Session, mensaje_id: int) -> ParteDiario:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if mensaje is None:
            raise ValueError(f"Mensaje {mensaje_id} no encontrado")
        metadata = mensaje.metadata_json or {}
        agent_v2 = metadata.get("agent_v2") or {}
        existing_id = agent_v2.get("parte_diario_id")
        if existing_id:
            existing = session.get(ParteDiario, int(existing_id))
            if existing is not None:
                return existing

        result = agent_v2.get("result") or {}
        if result.get("type") != "parte_diario_reply":
            raise ValueError(f"Mensaje {mensaje_id} no contiene resultado de parte_diario_reply")
        if not result.get("parte_listo"):
            raise ValueError(f"Mensaje {mensaje_id} no tiene parte_listo=True")
        if result.get("pendientes_ambiguos") or result.get("conflictos_novedad"):
            raise ValueError("El parte diario tiene resoluciones pendientes")

        idproyecto = int(result.get("idproyecto") or 0)
        fecha = date.fromisoformat(str(result.get("fecha") or ""))
        novedades = list(result.get("novedades") or [])
        if not novedades and not result.get("sin_novedades_informado"):
            raise ValueError("El parte diario vacio requiere declaracion explicita de sin novedades")
        present = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.abreviatura == "P")
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).first()
        if present is None:
            raise ValueError("No existe el estado activo PRESENTE (P)")
        self._validate_novedades(novedades, present_id=int(present.id))

        parte = self._resolve_parte(session, result, idproyecto=idproyecto, fecha=fecha)
        if parte is None:
            parte = ParteDiario(
                idproyecto=idproyecto,
                fecha=fecha,
                estado=EstadoParteDiario.BORRADOR,
                mensaje_origen_id=mensaje_id,
            )
            session.add(parte)
            session.flush()
        else:
            if parte.estado == EstadoParteDiario.CERRADO:
                raise ValueError("El parte diario ya fue cerrado por el administrador")
            parte.mensaje_origen_id = mensaje_id
            session.add(parte)
            session.flush()
            session.exec(
                delete(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
            )

        explicit_ids: set[int] = set()
        for novedad in novedades:
            idnomina = int(novedad["idnomina"])
            explicit_ids.add(idnomina)
            session.add(
                ParteDiarioDetalle(
                    parte_diario_id=int(parte.id),
                    idnomina=idnomina,
                    idestado=novedad.get("idestado"),
                    horas=Decimal(str(novedad["horas"])),
                    ingreso=_parse_datetime(novedad.get("ingreso")),
                    egreso=_parse_datetime(novedad.get("egreso")),
                    descripcion=novedad.get("descripcion"),
                    origen=OrigenDetalle.AGENTE,
                )
            )

        base_employees = session.exec(
            select(Nomina)
            .where(Nomina.idproyecto == idproyecto)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .where((Nomina.fecha_egreso.is_(None)) | (Nomina.fecha_egreso >= fecha))
        ).all()
        for employee in base_employees:
            if employee.id in explicit_ids:
                continue
            session.add(
                ParteDiarioDetalle(
                    parte_diario_id=int(parte.id),
                    idnomina=int(employee.id),
                    idestado=int(present.id),
                    horas=Decimal("9.0"),
                    origen=OrigenDetalle.DEFAULT,
                )
            )

        new_metadata = copy.deepcopy(metadata)
        new_metadata.setdefault("agent_v2", {})["parte_diario_id"] = parte.id
        mensaje.metadata_json = new_metadata
        flag_modified(mensaje, "metadata_json")
        session.add(mensaje)
        session.commit()
        session.refresh(parte)
        return parte

    @staticmethod
    def _resolve_parte(
        session: Session,
        result: dict[str, Any],
        *,
        idproyecto: int,
        fecha: date,
    ) -> ParteDiario | None:
        requested_id = result.get("parte_id_existente")
        if requested_id:
            parte = session.get(ParteDiario, int(requested_id))
            if parte is None:
                raise ValueError("El borrador retomado ya no existe")
            if parte.idproyecto != idproyecto or parte.fecha != fecha:
                raise ValueError("El borrador retomado no coincide con el proyecto y fecha informados")
            return parte
        return session.exec(
            select(ParteDiario)
            .where(ParteDiario.idproyecto == idproyecto)
            .where(ParteDiario.fecha == fecha)
            .where(ParteDiario.deleted_at.is_(None))
        ).first()

    @staticmethod
    def _validate_novedades(novedades: list[dict[str, Any]], *, present_id: int) -> None:
        ids: set[int] = set()
        for item in novedades:
            idnomina = item.get("idnomina")
            if idnomina is None:
                raise ValueError("Hay novedades sin idnomina resuelto")
            parsed_id = int(idnomina)
            if parsed_id in ids:
                raise ValueError("Hay mas de una novedad para la misma persona")
            ids.add(parsed_id)
            if item.get("horas") is None:
                raise ValueError("Hay novedades sin horas normalizadas")
            hours = Decimal(str(item["horas"]))
            if hours < 0 or hours > 24:
                raise ValueError("Hay novedades con horas fuera de rango")
            if not item.get("fuera_de_proyecto") and item.get("idestado") is None:
                raise ValueError("Hay novedades internas sin estado resuelto")
            if (
                not item.get("fuera_de_proyecto")
                and item.get("idestado") == present_id
                and hours < 9
            ):
                raise ValueError("PRESENTE requiere al menos 9 horas para personal interno")


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(str(value))


parte_diario_service = ParteDiarioService()
