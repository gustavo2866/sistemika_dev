"""Servicio de emision de mensajes intermedios para agente v3."""

from __future__ import annotations

from typing import Any, Protocol

from agente.v3.contracts import V3InboundMessage, V3OutboundMessage
from agente.v3.outbox.queue import V3Outbox


class V3MessageEmitter(Protocol):
    async def emitir(self, texto: str, metadata: dict[str, Any] | None = None) -> str:
        ...


class NullV3MessageEmitter:
    async def emitir(self, texto: str, metadata: dict[str, Any] | None = None) -> str:
        return ""


class OutboxV3MessageEmitter:
    def __init__(self, *, outbox: V3Outbox, source: V3InboundMessage) -> None:
        self._outbox = outbox
        self._source = source
        self.emitted_ids: list[str] = []

    async def emitir(self, texto: str, metadata: dict[str, Any] | None = None) -> str:
        text = str(texto or "").strip()
        if not text:
            return ""
        outbound = V3OutboundMessage.recorded_meta_reply(
            source=self._source,
            text=text,
            interactive=_outbound_interactive(metadata or {}),
        )
        outbound_id = await self._outbox.enqueue(outbound)
        self.emitted_ids.append(outbound_id)
        return outbound_id


def _outbound_interactive(metadata: dict[str, Any]) -> dict[str, Any] | None:
    outbound = metadata.get("outbound")
    if not isinstance(outbound, dict):
        return None
    if outbound.get("type") != "interactive":
        return None
    interactive = outbound.get("interactive")
    return interactive if isinstance(interactive, dict) else None
