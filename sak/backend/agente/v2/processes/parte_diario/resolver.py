"""Resolucion local de nomina y catalogos para parte_diario."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from agente.v2.processes.parte_diario.models import EstadoItem, NominaItem


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: str | None) -> set[str]:
    return set(normalize_text(value).split())


@dataclass(slots=True)
class ResolveResult:
    match: NominaItem | None = None
    candidatos: list[NominaItem] | None = None
    error: str | None = None

    @property
    def ambiguo(self) -> bool:
        return bool(self.candidatos)


class NominaResolver:
    @staticmethod
    def resolve(
        nombre: str,
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> ResolveResult:
        project_matches = NominaResolver._matches(nombre, nominas_proyecto)
        if len(project_matches) == 1:
            return ResolveResult(match=project_matches[0])
        if len(project_matches) > 1:
            return ResolveResult(candidatos=project_matches)

        project_ids = {item.idnomina for item in nominas_proyecto}
        external_matches = [
            item for item in NominaResolver._matches(nombre, nominas_completas)
            if item.idnomina not in project_ids
        ]
        for item in external_matches:
            item.fuera_de_proyecto = True
        if len(external_matches) == 1:
            return ResolveResult(match=external_matches[0])
        if len(external_matches) > 1:
            return ResolveResult(candidatos=external_matches)
        return ResolveResult(error=f"No encontre a {nombre} en la nomina activa.")

    @staticmethod
    def _matches(nombre: str, candidates: list[NominaItem]) -> list[NominaItem]:
        searched = _tokens(nombre)
        if not searched:
            return []
        return [
            item
            for item in candidates
            if searched <= _tokens(f"{item.apellido} {item.nombre}")
        ]


def resolve_estado_codigo(codigo: str | None, estados: list[EstadoItem]) -> EstadoItem | None:
    normalized = normalize_text(codigo).upper()
    for estado in estados:
        if estado.abreviatura.upper() == normalized:
            return estado
    return None


def parse_estado_local(text: str, estados: list[EstadoItem]) -> EstadoItem | None:
    normalized = normalize_text(text)
    if normalized.isdigit():
        index = int(normalized) - 1
        available = [estado for estado in estados if estado.abreviatura.upper() != "P"]
        return available[index] if 0 <= index < len(available) else None
    aliases = {
        "falto": "FAL",
        "falta": "FAL",
        "enfermo": "ENF",
        "enfermedad": "ENF",
        "accidente": "ACC",
        "vacaciones": "VAC",
        "permiso": "PER",
        "lluvia": "LLV",
        "feriado": "FER",
        "presente": "P",
    }
    alias = aliases.get(normalized)
    for estado in estados:
        if alias == estado.abreviatura.upper():
            return estado
        if normalized in {normalize_text(estado.abreviatura), normalize_text(estado.nombre)}:
            return estado
    return None


def parse_candidate_selection(text: str, candidates: list[NominaItem]) -> NominaItem | None:
    normalized = normalize_text(text)
    numbers = re.findall(r"\d+", normalized)
    if len(numbers) == 1:
        index = int(numbers[0]) - 1
        return candidates[index] if 0 <= index < len(candidates) else None
    searched = _tokens(normalized) - {"el", "la", "de", "del"}
    if not searched:
        return None
    matches = [
        item for item in candidates
        if searched <= _tokens(f"{item.apellido} {item.nombre}")
    ]
    return matches[0] if len(matches) == 1 else None
