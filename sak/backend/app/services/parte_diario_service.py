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
    OrigenDetalle,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
)
from app.models.enums import CanalMensaje, EstadoMensaje, TipoMensaje
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.types import ChannelEventData


class ParteDiarioService:
    def create_or_update_from_agent_message(self, session: Session, mensaje_id: int) -> ParteDiario:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if mensaje is None:
            raise ValueError(f"Mensaje {mensaje_id} no encontrado")
        metadata = mensaje.metadata_json or {}
        agent_key, agent_metadata = self._extract_agent_metadata(metadata)
        existing_id = agent_metadata.get("parte_diario_id")
        if existing_id:
            existing = session.get(ParteDiario, int(existing_id))
            if existing is not None:
                return existing

        result = agent_metadata.get("result") or {}
        if result.get("type") != "parte_diario_reply":
            raise ValueError(f"Mensaje {mensaje_id} no contiene resultado de parte_diario_reply")
        parte = self._create_or_update_from_result(session, result, mensaje_id=mensaje_id)

        new_metadata = copy.deepcopy(metadata)
        new_metadata.setdefault(agent_key, {})["parte_diario_id"] = parte.id
        mensaje.metadata_json = new_metadata
        flag_modified(mensaje, "metadata_json")
        session.add(mensaje)
        session.commit()
        session.refresh(parte)
        return parte

    def create_or_update_from_agent_v3_confirmation(
        self,
        session: Session,
        *,
        contacto_id: int,
        oportunidad_id: int,
        result: dict[str, Any],
        conversation_id: str,
        provider: str,
        channel_type: str,
        account_ref: str,
        from_address: str,
        to_address: str,
        external_message_id: str,
        text: str | None,
        message_type: str,
        raw_payload: dict[str, Any],
        normalized_payload: dict[str, Any],
        received_at: datetime,
    ) -> ParteDiario:
        """Materializa el parte confirmado por agente v3.

        Crea o reutiliza un CRMMensaje final de confirmacion para mantener el
        mismo punto de trazabilidad que los procesos CRM historicos.
        """
        if contacto_id <= 0:
            raise ValueError("contacto_id requerido")
        if oportunidad_id <= 0:
            raise ValueError("oportunidad_id requerido")

        channel_event = channel_event_store.record(
            session,
            ChannelEventData(
                provider=provider,
                channel_type=channel_type,
                account_ref=account_ref,
                direction="inbound",
                from_address=from_address,
                to_address=to_address,
                external_message_id=external_message_id,
                status="received",
                occurred_at=received_at,
                raw_payload=raw_payload,
                normalized_payload=normalized_payload,
            ),
        )
        mensaje = self._find_or_create_v3_confirmation_message(
            session,
            contacto_id=contacto_id,
            oportunidad_id=oportunidad_id,
            result=result,
            conversation_id=conversation_id,
            provider=provider,
            channel_type=channel_type,
            account_ref=account_ref,
            from_address=from_address,
            to_address=to_address,
            external_message_id=external_message_id,
            text=text,
            message_type=message_type,
            received_at=received_at,
            channel_event_id=channel_event.id,
        )
        return self.create_or_update_from_agent_message(session, int(mensaje.id))

    def _create_or_update_from_result(
        self,
        session: Session,
        result: dict[str, Any],
        *,
        mensaje_id: int | None,
    ) -> ParteDiario:
        if not result.get("parte_listo"):
            raise ValueError("El mensaje no tiene parte_listo=True")
        should_confirm = bool(result.get("confirmar_parte") or result.get("cerrar_parte"))
        target_estado = EstadoParteDiario.CONFIRMADO if should_confirm else EstadoParteDiario.BORRADOR
        if target_estado == EstadoParteDiario.CONFIRMADO and (
            result.get("pendientes_ambiguos") or result.get("conflictos_novedad")
        ):
            raise ValueError("El parte diario tiene resoluciones pendientes")

        idproyecto = int(result.get("idproyecto") or 0)
        contacto_id = int(result.get("contacto_id") or 0)
        if contacto_id <= 0 and mensaje_id is not None:
            mensaje = session.get(CRMMensaje, mensaje_id)
            contacto_id = int(mensaje.contacto_id or 0) if mensaje is not None else 0
        fecha = date.fromisoformat(str(result.get("fecha") or ""))
        raw_novedades = list(result.get("novedades") or [])
        novedades = [item for item in raw_novedades if item.get("idnomina") is not None]
        pendientes_provisorios = list(result.get("pendientes_ambiguos") or [])
        novedades_provisorias = [item for item in raw_novedades if item.get("idnomina") is None]
        if target_estado == EstadoParteDiario.CONFIRMADO and novedades_provisorias:
            raise ValueError("El parte diario tiene novedades sin validar")
        if target_estado == EstadoParteDiario.BORRADOR:
            pendientes_provisorios.extend(novedades_provisorias)
        if target_estado == EstadoParteDiario.CONFIRMADO and not novedades and not result.get("sin_novedades_informado"):
            raise ValueError("El parte diario vacio requiere declaracion explicita de sin novedades")
        present_id = None
        if novedades:
            present = session.exec(
                select(ParteDiarioEstado)
                .where(ParteDiarioEstado.abreviatura == "P")
                .where(ParteDiarioEstado.activo.is_(True))
                .where(ParteDiarioEstado.deleted_at.is_(None))
            ).first()
            if present is None:
                raise ValueError("No existe el estado activo PRESENTE (P)")
            present_id = int(present.id)
        self._validate_novedades(
            novedades,
            present_id=present_id,
            require_close_rules=target_estado == EstadoParteDiario.CONFIRMADO,
        )

        parte = self._resolve_parte(
            session,
            result,
            idproyecto=idproyecto,
            fecha=fecha,
            contacto_id=contacto_id,
        )
        if parte is None:
            parte = ParteDiario(
                idproyecto=idproyecto,
                contacto_id=contacto_id or None,
                fecha=fecha,
                estado=target_estado,
                mensaje_origen_id=mensaje_id,
            )
            session.add(parte)
            session.flush()
        else:
            if parte.estado in {EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO}:
                raise ValueError("El parte diario ya fue confirmado")
            if contacto_id > 0:
                parte.contacto_id = contacto_id
            parte.mensaje_origen_id = mensaje_id
            session.add(parte)
            session.flush()
            session.exec(
                delete(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
            )

        parte.estado = target_estado
        session.add(parte)

        for novedad in novedades:
            idnomina = int(novedad["idnomina"])
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

        for pending in pendientes_provisorios:
            nombre = str(pending.get("nombre") or "").strip()
            if not nombre:
                continue
            session.add(
                ParteDiarioDetalle(
                    parte_diario_id=int(parte.id),
                    idnomina=None,
                    nombre_provisorio=nombre,
                    idestado=pending.get("idestado"),
                    horas=Decimal(str(_provisional_hours(pending))),
                    descripcion=pending.get("descripcion"),
                    origen=OrigenDetalle.AGENTE,
                )
            )

        return parte

    @staticmethod
    def _extract_agent_metadata(metadata: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        return "agent_v3", metadata.get("agent_v3") or {}

    def _find_or_create_v3_confirmation_message(
        self,
        session: Session,
        *,
        contacto_id: int,
        oportunidad_id: int,
        result: dict[str, Any],
        conversation_id: str,
        provider: str,
        channel_type: str,
        account_ref: str,
        from_address: str,
        to_address: str,
        external_message_id: str,
        text: str | None,
        message_type: str,
        received_at: datetime,
        channel_event_id: int | None,
    ) -> CRMMensaje:
        existing = session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.origen_externo_id == external_message_id)
            .limit(1)
        ).first()
        if existing:
            return existing

        mensaje = CRMMensaje(
            tipo=TipoMensaje.ENTRADA.value,
            canal=CanalMensaje.WHATSAPP.value,
            contacto_id=contacto_id,
            contacto_referencia=from_address,
            oportunidad_id=oportunidad_id,
            estado=EstadoMensaje.RECIBIDO.value,
            asunto="Parte diario confirmado",
            contenido=self._build_v3_confirmation_content(result),
            fecha_mensaje=received_at,
            origen_externo_id=external_message_id,
            metadata_json={
                "agent_v3": {
                    "result": result,
                    "channel_event_id": channel_event_id,
                    "conversation_id": conversation_id,
                    "external_message_id": external_message_id,
                    "provider": provider,
                    "channel_type": channel_type,
                    "account_ref": account_ref,
                    "from_address": from_address,
                    "to_address": to_address,
                    "message_type": message_type,
                    "confirmation_text": text,
                }
            },
        )
        session.add(mensaje)
        session.flush()
        return mensaje

    @staticmethod
    def _build_v3_confirmation_content(result: dict[str, Any]) -> str:
        fecha = result.get("fecha") or "sin fecha"
        novedades = result.get("novedades") or []
        pendientes = result.get("pendientes_ambiguos") or []
        if result.get("sin_novedades_informado") and not novedades and not pendientes:
            return f"Parte diario confirmado para {fecha}: sin novedades."
        lines = []
        for item in novedades:
            nombre = item.get("nombre") or item.get("idnomina") or "persona"
            estado = item.get("estado_codigo") or "sin estado"
            horas = item.get("horas")
            lines.append(f"- {nombre}: {estado}, {horas}h")
        for item in pendientes:
            nombre = item.get("nombre") or "persona"
            estado = item.get("estado_codigo") or "sin estado"
            horas = _provisional_hours(item)
            lines.append(f"- {nombre} (a validar): {estado}, {horas}h")
        return f"Parte diario confirmado para {fecha}:\n" + "\n".join(lines)

    @staticmethod
    def _resolve_parte(
        session: Session,
        result: dict[str, Any],
        *,
        idproyecto: int,
        fecha: date,
        contacto_id: int = 0,
    ) -> ParteDiario | None:
        requested_id = result.get("parte_id_existente")
        if requested_id:
            parte = session.get(ParteDiario, int(requested_id))
            if parte is None:
                raise ValueError("El borrador retomado ya no existe")
            if parte.idproyecto != idproyecto or parte.fecha != fecha:
                raise ValueError("El borrador retomado no coincide con el proyecto y fecha informados")
            if contacto_id > 0 and parte.contacto_id not in {None, contacto_id}:
                raise ValueError("El borrador retomado no corresponde al contacto que reporta")
            return parte
        base_query = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto == idproyecto)
            .where(ParteDiario.fecha == fecha)
            .where(ParteDiario.deleted_at.is_(None))
        )
        if contacto_id > 0:
            parte = session.exec(base_query.where(ParteDiario.contacto_id == contacto_id)).first()
            if parte is not None:
                return parte
            return session.exec(base_query.where(ParteDiario.contacto_id.is_(None))).first()
        return session.exec(base_query).first()

    @staticmethod
    def _validate_novedades(
        novedades: list[dict[str, Any]],
        *,
        present_id: int | None,
        require_close_rules: bool,
    ) -> None:
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
            if require_close_rules and not item.get("fuera_de_proyecto") and item.get("idestado") is None:
                raise ValueError("Hay novedades internas sin estado resuelto")
            if (
                require_close_rules
                and not item.get("fuera_de_proyecto")
                and present_id is not None
                and item.get("idestado") == present_id
                and hours < 9
            ):
                raise ValueError("PRESENTE requiere al menos 9 horas para personal interno")


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(str(value))


def _provisional_hours(item: dict[str, Any]) -> float:
    if item.get("horas") is not None:
        return float(item["horas"])
    if item.get("horas_extra") is not None:
        return 9.0 + float(item["horas_extra"])
    normalized_code = str(item.get("estado_codigo") or "").upper()
    if normalized_code == "P":
        return 9.0
    return 0.0


parte_diario_service = ParteDiarioService()
