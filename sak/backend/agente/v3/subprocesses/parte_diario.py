"""Subproceso parteDiario v3."""

from agente.v3.orchestrator.process_selector import PROCESS_PARTE_DIARIO
from agente.v3.subprocesses.base import V3TimingSubprocess


class ParteDiarioSubprocess(V3TimingSubprocess):
    name = PROCESS_PARTE_DIARIO

