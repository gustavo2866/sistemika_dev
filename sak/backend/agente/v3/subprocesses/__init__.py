"""Capa 03-sub-proceso del agente v3."""

from agente.v3.subprocesses.base import V3Subprocess, V3TimingSubprocess
from agente.v3.subprocesses.general import GeneralSubprocess
from agente.v3.subprocesses.parte_diario import ParteDiarioSubprocess
from agente.v3.subprocesses.pedido_obra import PedidoObraSubprocess
from agente.v3.subprocesses.registry import V3SubprocessRegistry, default_subprocess_registry

__all__ = [
    "GeneralSubprocess",
    "ParteDiarioSubprocess",
    "PedidoObraSubprocess",
    "V3Subprocess",
    "V3SubprocessRegistry",
    "V3TimingSubprocess",
    "default_subprocess_registry",
]

