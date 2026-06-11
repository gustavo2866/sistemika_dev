"""Registro de subprocesos disponibles para agente v3."""

from __future__ import annotations

from agente.v3.subprocesses.base import V3Subprocess
from agente.v3.subprocesses.general import GeneralSubprocess
from agente.v3.subprocesses.parte_diario import ParteDiarioSubprocess
from agente.v3.subprocesses.pedido_obra import PedidoObraSubprocess


class V3SubprocessRegistry:
    """Registro simple de subprocesos v3."""

    def __init__(self, processes: list[V3Subprocess]) -> None:
        self._processes = {process.name: process for process in processes}

    def get(self, process_name: str) -> V3Subprocess | None:
        return self._processes.get(process_name)


default_subprocess_registry = V3SubprocessRegistry(
    [
        GeneralSubprocess(),
        PedidoObraSubprocess(),
        ParteDiarioSubprocess(),
    ]
)

