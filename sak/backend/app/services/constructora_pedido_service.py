"""Servicio para gestión de pedidos de obra (constructora)."""
from __future__ import annotations

import copy
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.models import CRMMensaje
from app.models.enums import CanalMensaje, EstadoMensaje, TipoMensaje
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleEstado,
    PedidoObraDetalleOrigen,
    PedidoObraEstado,
    PedidoObraOrigen,
)
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.types import ChannelEventData


class ConstructoraPedidoService:

    def create_from_agent_message(
        self,
        session: Session,
        mensaje_id: int,
    ) -> ConstructoraPedido:
        """Crea un ConstructoraPedido a partir de un CRMMensaje confirmado por el agente.

        Idempotente: si ya existe un pedido para ese mensaje_origen_id lo retorna sin crear uno nuevo.

        Raises:
            ValueError: si el mensaje no existe, no viene del agente, o no tiene pedido_listo=True.
        """
        # Idempotencia: verificar si ya existe
        existing = session.exec(
            select(ConstructoraPedido).where(
                ConstructoraPedido.mensaje_origen_id == mensaje_id
            )
        ).first()
        if existing:
            return existing

        # Cargar mensaje
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError(f"Mensaje {mensaje_id} no encontrado")

        # Leer result del agente
        metadata = mensaje.metadata_json or {}
        agent_key, result = self._extract_agent_result(metadata)

        if result.get("type") != "pedido_obra_reply":
            raise ValueError(
                f"Mensaje {mensaje_id} no contiene resultado de pedido_obra_reply"
            )
        if not result.get("pedido_listo"):
            raise ValueError(
                f"Mensaje {mensaje_id} no tiene pedido_listo=True"
            )

        oportunidad_id = result.get("oportunidad_id") or mensaje.oportunidad_id
        if not oportunidad_id:
            raise ValueError(
                f"Mensaje {mensaje_id} no tiene oportunidad_id"
            )

        items = result.get("items") or []
        estado_pedido = PedidoObraEstado.CERRADO if result.get("cerrar_pedido") else PedidoObraEstado.BORRADOR

        # Crear pedido
        pedido = ConstructoraPedido(
            oportunidad_id=oportunidad_id,
            contacto_id=mensaje.contacto_id,
            mensaje_origen_id=mensaje_id,
            estado=estado_pedido,
            origen=PedidoObraOrigen.AGENTE,
            titulo=f"Pedido de obra — oportunidad #{oportunidad_id}",
            fecha_confirmacion_agente=datetime.now(UTC),
            metadata_json={
                "agent_source": agent_key,
                "agent_result": result,
            },
        )
        session.add(pedido)
        session.flush()  # obtener pedido.id

        # Crear líneas
        for orden, item in enumerate(items):
            cantidad_raw = item.get("cantidad")
            try:
                cantidad = Decimal(str(cantidad_raw)) if cantidad_raw is not None else Decimal("1")
            except Exception:
                cantidad = Decimal("1")

            detalle = ConstructoraPedidoDetalle(
                pedido_id=pedido.id,
                descripcion_original=item.get("descripcion"),
                descripcion=item.get("descripcion"),
                cantidad=cantidad,
                cantidad_original=cantidad,
                unidad_medida=item.get("unidad"),
                estado=PedidoObraDetalleEstado.ACTIVA,
                origen=PedidoObraDetalleOrigen.AGENTE,
                orden=orden,
                metadata_json={"agent_item_id": item.get("item_id")},
            )
            session.add(detalle)

        # Escribir pedido_obra_id de vuelta en el mensaje
        self._write_pedido_obra_id_to_message(mensaje, int(pedido.id), agent_key=agent_key)

        session.commit()
        session.refresh(pedido)
        return pedido

    def create_from_agent_v3_confirmation(
        self,
        session: Session,
        *,
        pedido_id: int | None = None,
        contacto_id: int,
        oportunidad_id: int,
        proyecto_id: int | None,
        items: list[dict[str, Any]],
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
        cerrar_pedido: bool = False,
    ) -> ConstructoraPedido:
        """Materializa el pedido confirmado por agente v3.

        Solo crea el CRMMensaje final de confirmacion y deja trazabilidad hacia
        channel_events por conversation_id y channel_event_id.
        """
        if contacto_id <= 0:
            raise ValueError("contacto_id requerido")
        if oportunidad_id <= 0:
            raise ValueError("oportunidad_id requerido")
        valid_items = self._validate_agent_items(items)

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
            proyecto_id=proyecto_id,
            items=valid_items,
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
            cerrar_pedido=cerrar_pedido,
        )
        if pedido_id is not None:
            return self.update_existing_from_agent_v3_confirmation(
                session,
                pedido_id=pedido_id,
                mensaje_id=int(mensaje.id),
                contacto_id=contacto_id,
                oportunidad_id=oportunidad_id,
                items=valid_items,
                cerrar_pedido=cerrar_pedido,
            )
        return self.create_from_agent_message(session, int(mensaje.id))

    def update_existing_from_agent_v3_confirmation(
        self,
        session: Session,
        *,
        pedido_id: int,
        mensaje_id: int,
        contacto_id: int,
        oportunidad_id: int,
        items: list[dict[str, Any]],
        cerrar_pedido: bool = False,
    ) -> ConstructoraPedido:
        """Actualiza un pedido borrador ya seleccionado por el agente v3."""
        pedido = session.get(ConstructoraPedido, pedido_id)
        if pedido is None or pedido.deleted_at is not None:
            raise ValueError(f"Pedido {pedido_id} no encontrado")
        if int(pedido.oportunidad_id) != oportunidad_id:
            raise ValueError("El pedido no pertenece a la oportunidad seleccionada")
        if int(pedido.contacto_id or 0) != contacto_id:
            raise ValueError("El pedido no pertenece al contacto que reporta")
        estado_actual = pedido.estado.value if hasattr(pedido.estado, "value") else str(pedido.estado)
        if estado_actual != PedidoObraEstado.BORRADOR.value:
            raise ValueError("Solo se puede actualizar un pedido en borrador")

        mensaje = session.get(CRMMensaje, mensaje_id)
        if mensaje is None:
            raise ValueError(f"Mensaje {mensaje_id} no encontrado")

        linked = session.exec(
            select(ConstructoraPedido)
            .where(ConstructoraPedido.mensaje_origen_id == mensaje_id)
            .where(ConstructoraPedido.id != pedido_id)
            .limit(1)
        ).first()
        if linked is not None:
            raise ValueError("El mensaje de confirmacion ya esta vinculado a otro pedido")

        now = datetime.now(UTC)
        pedido.contacto_id = contacto_id
        pedido.mensaje_origen_id = mensaje_id
        pedido.estado = PedidoObraEstado.CERRADO if cerrar_pedido else PedidoObraEstado.BORRADOR
        pedido.fecha_confirmacion_agente = now
        pedido.updated_at = now
        pedido.metadata_json = {
            **(pedido.metadata_json or {}),
            "agent_source": "agent_v3",
            "agent_result": self._agent_v3_result_from_message(mensaje),
        }
        flag_modified(pedido, "metadata_json")

        detalles = session.exec(
            select(ConstructoraPedidoDetalle)
            .where(ConstructoraPedidoDetalle.pedido_id == pedido_id)
            .where(ConstructoraPedidoDetalle.deleted_at.is_(None))
        ).all()
        for detalle in detalles:
            detalle.deleted_at = now
            detalle.estado = PedidoObraDetalleEstado.CANCELADA
            detalle.updated_at = now
            session.add(detalle)

        for orden, item in enumerate(items):
            cantidad = Decimal(str(item["cantidad"]))
            session.add(
                ConstructoraPedidoDetalle(
                    pedido_id=pedido_id,
                    descripcion_original=item["descripcion"],
                    descripcion=item["descripcion"],
                    cantidad=cantidad,
                    cantidad_original=cantidad,
                    unidad_medida=item.get("unidad"),
                    estado=PedidoObraDetalleEstado.ACTIVA,
                    origen=PedidoObraDetalleOrigen.AGENTE,
                    orden=orden,
                    metadata_json={"agent_item_id": item.get("item_id")},
                )
            )

        self._write_pedido_obra_id_to_message(mensaje, pedido_id)

        session.add(pedido)
        session.commit()
        session.refresh(pedido)
        return pedido

    @staticmethod
    def _extract_agent_result(metadata: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        agent_metadata = metadata.get("agent_v3") or {}
        return "agent_v3", agent_metadata.get("result") or {}

    @staticmethod
    def _agent_v3_result_from_message(mensaje: CRMMensaje) -> dict[str, Any]:
        metadata = mensaje.metadata_json or {}
        agent_metadata = metadata.get("agent_v3") or {}
        return agent_metadata.get("result") or {}

    @staticmethod
    def _write_pedido_obra_id_to_message(
        mensaje: CRMMensaje,
        pedido_id: int,
        *,
        agent_key: str = "agent_v3",
    ) -> None:
        new_metadata = copy.deepcopy(mensaje.metadata_json or {})
        new_metadata.setdefault(agent_key, {})
        new_metadata[agent_key]["pedido_obra_id"] = pedido_id
        mensaje.metadata_json = new_metadata
        flag_modified(mensaje, "metadata_json")

    @staticmethod
    def _validate_agent_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not items:
            raise ValueError("items requerido")

        valid_items: list[dict[str, Any]] = []
        for item in items:
            descripcion = str(item.get("descripcion") or "").strip()
            if not descripcion:
                raise ValueError("descripcion requerida")

            cantidad_raw = item.get("cantidad")
            try:
                cantidad = Decimal(str(cantidad_raw))
            except Exception as exc:
                raise ValueError(f"cantidad invalida para {descripcion}") from exc
            if cantidad <= 0:
                raise ValueError(f"cantidad invalida para {descripcion}")

            valid_items.append(
                {
                    "item_id": item.get("item_id"),
                    "descripcion": descripcion,
                    "cantidad": str(cantidad),
                    "unidad": item.get("unidad"),
                }
            )
        return valid_items

    def _find_or_create_v3_confirmation_message(
        self,
        session: Session,
        *,
        contacto_id: int,
        oportunidad_id: int,
        proyecto_id: int | None,
        items: list[dict[str, Any]],
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
        cerrar_pedido: bool = False,
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

        result = {
            "type": "pedido_obra_reply",
            "pedido_listo": True,
            "contacto_id": contacto_id,
            "oportunidad_id": oportunidad_id,
            "proyecto_id": proyecto_id,
            "items": items,
            "cerrar_pedido": cerrar_pedido,
        }
        mensaje = CRMMensaje(
            tipo=TipoMensaje.ENTRADA.value,
            canal=CanalMensaje.WHATSAPP.value,
            contacto_id=contacto_id,
            contacto_referencia=from_address,
            oportunidad_id=oportunidad_id,
            estado=EstadoMensaje.RECIBIDO.value,
            asunto="Pedido de obra confirmado",
            contenido=self._build_v3_confirmation_content(items),
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
    def _build_v3_confirmation_content(items: list[dict[str, Any]]) -> str:
        lines: list[str] = []
        for item in items:
            parts = [str(item["cantidad"])]
            if item.get("unidad"):
                parts.append(str(item["unidad"]))
            parts.append(str(item["descripcion"]))
            lines.append(" ".join(parts))
        return "Pedido de obra confirmado:\n" + "\n".join(f"- {line}" for line in lines)


constructora_pedido_service = ConstructoraPedidoService()
