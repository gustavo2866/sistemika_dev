"""Subproceso general v3."""

from agente.v3.orchestrator.process_selector import PROCESS_GENERAL
from agente.v3.subprocesses.base import V3TimingSubprocess


class GeneralSubprocess(V3TimingSubprocess):
    name = PROCESS_GENERAL

