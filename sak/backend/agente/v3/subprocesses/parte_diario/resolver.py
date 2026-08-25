"""Resolucion local de nomina y catalogos para parte_diario."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

from agente.v3.subprocesses.parte_diario.models import EstadoItem, NominaItem


def normalize_text(value: str | None) -> str:
    text = _repair_common_mojibake(str(value or "")).lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def project_match_score(query: str | None, project_name: str | None) -> float:
    normalized_query = normalize_text(query)
    normalized_name = normalize_text(project_name)
    if not normalized_query or not normalized_name:
        return 0.0
    if normalized_query == normalized_name:
        return 1.0
    if normalized_query in normalized_name:
        return 0.95
    query_tokens = {token for token in normalized_query.split() if len(token) >= 3}
    name_tokens = {token for token in normalized_name.split() if len(token) >= 3}
    if query_tokens and query_tokens <= name_tokens:
        return 0.9
    if query_tokens and query_tokens & name_tokens:
        return 0.75
    token_similarity = max(
        (
            SequenceMatcher(None, query_token, name_token).ratio()
            for query_token in query_tokens
            for name_token in name_tokens
        ),
        default=0.0,
    )
    full_similarity = SequenceMatcher(None, normalized_query, normalized_name).ratio()
    return max(token_similarity, full_similarity)


def _repair_common_mojibake(value: str) -> str:
    if "Ã" not in value and "Â" not in value:
        return value
    try:
        return value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value


def _tokens(value: str | None) -> set[str]:
    return set(normalize_text(value).split())


def _candidate_search_text(item: NominaItem) -> str:
    return " ".join(
        value
        for value in (
            item.apellido,
            item.nombre,
            item.nombre_completo,
            item.nro_legajo,
        )
        if value
    )


@dataclass(slots=True)
class ResolveResult:
    match: NominaItem | None = None
    candidatos: list[NominaItem] | None = None
    candidatos_externos: list[NominaItem] | None = None
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
        external_matches = NominaResolver._external_matches(project_matches, NominaResolver._matches(nombre, nominas_completas))
        if len(project_matches) == 1:
            return ResolveResult(match=project_matches[0])
        if len(project_matches) > 1:
            return ResolveResult(candidatos=project_matches, candidatos_externos=external_matches)
        if len(external_matches) == 1:
            return ResolveResult(match=external_matches[0])
        if len(external_matches) > 1:
            return ResolveResult(candidatos=external_matches, candidatos_externos=external_matches)
        return ResolveResult(error=f"No encontre a {nombre} en la nomina activa.")

    @staticmethod
    def find_similar(
        nombre: str,
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> list[NominaItem]:
        project_similar, external_similar = NominaResolver.find_similar_grouped(
            nombre,
            nominas_proyecto,
            nominas_completas,
        )
        return project_similar or external_similar

    @staticmethod
    def find_similar_grouped(
        nombre: str,
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> tuple[list[NominaItem], list[NominaItem]]:
        project_similar = NominaResolver._similar_matches(nombre, nominas_proyecto)
        external_similar = NominaResolver._external_matches(
            nominas_proyecto,
            NominaResolver._similar_matches(nombre, nominas_completas),
        )
        return project_similar, external_similar

    @staticmethod
    def _external_matches(project_items: list[NominaItem], all_matches: list[NominaItem]) -> list[NominaItem]:
        project_ids = {item.idnomina for item in project_items}
        external = [item for item in all_matches if item.idnomina not in project_ids]
        for item in external:
            item.fuera_de_proyecto = True
        return external

    @staticmethod
    def _matches(nombre: str, candidates: list[NominaItem]) -> list[NominaItem]:
        searched = _tokens(nombre)
        if not searched:
            return []
        return [
            item
            for item in candidates
            if searched <= _tokens(_candidate_search_text(item))
        ]

    @staticmethod
    def _similar_matches(nombre: str, candidates: list[NominaItem]) -> list[NominaItem]:
        searched_tokens = _tokens(nombre)
        if not searched_tokens:
            return []
        scored: list[tuple[float, NominaItem]] = []
        for item in candidates:
            candidate_tokens = _tokens(_candidate_search_text(item))
            if not candidate_tokens:
                continue
            score = max(
                SequenceMatcher(None, searched, candidate).ratio()
                for searched in searched_tokens
                for candidate in candidate_tokens
            )
            if score >= 0.78:
                scored.append((score, item))
        scored.sort(key=lambda pair: (-pair[0], pair[1].apellido, pair[1].nombre))
        return [item for _, item in scored]


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
        "accidento": "ACC",
        "accidentado": "ACC",
        "accidentada": "ACC",
        "vacaciones": "VAC",
        "permiso": "PER",
        "lluvia": "LLV",
        "feriado": "FER",
        "presente": "P",
        "trabajo": "P",
        "vino": "P",
    }
    alias = aliases.get(normalized)
    if alias is None:
        for token in normalized.split():
            alias = aliases.get(token)
            if alias is not None:
                break
    for estado in estados:
        if alias == estado.abreviatura.upper():
            return estado
        if normalized in {normalize_text(estado.abreviatura), normalize_text(estado.nombre)}:
            return estado
    return None


def parse_candidate_selection(
    text: str,
    candidates: list[NominaItem],
    *,
    offset: int = 0,
    visible_count: int | None = None,
) -> NominaItem | None:
    normalized = normalize_text(text)
    numbers = re.findall(r"\d+", normalized)
    if len(numbers) == 1:
        local_index = int(numbers[0]) - 1
        if visible_count is not None and not 0 <= local_index < visible_count:
            return None
        index = offset + local_index
        return candidates[index] if 0 <= index < len(candidates) else None
    searched = _tokens(normalized) - {"el", "la", "de", "del"}
    if not searched:
        return None
    matches = [
        item for item in candidates
        if searched <= _tokens(_candidate_search_text(item))
    ]
    return matches[0] if len(matches) == 1 else None


def filter_candidate_selection(text: str, candidates: list[NominaItem]) -> list[NominaItem]:
    normalized = normalize_text(text)
    if normalized.isdigit():
        return []
    searched = _tokens(normalized) - {"el", "la", "de", "del"}
    if not searched:
        return []
    return [
        item for item in candidates
        if searched <= _tokens(_candidate_search_text(item))
    ]
