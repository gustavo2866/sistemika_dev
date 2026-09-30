"""Configuracion del modelo OpenAI usado por Parte Diario."""

from __future__ import annotations

import os


DEFAULT_PARTE_DIARIO_MODEL = "gpt-6-luna"
DEFAULT_PARTE_DIARIO_REASONING_EFFORT = "low"


def resolve_parte_diario_model(
    model: str | None = None,
    *,
    specific_model_env: str | None = None,
    reasoning_effort: str | None = None,
) -> tuple[str, str | None]:
    """Resuelve modelo y razonamiento sin alterar los defaults del agente v3."""
    selected_model = (
        model
        or (os.getenv(specific_model_env) if specific_model_env else None)
        or os.getenv("OPENAI_PARTE_DIARIO_MODEL")
        or DEFAULT_PARTE_DIARIO_MODEL
    )
    selected_effort = reasoning_effort or os.getenv("OPENAI_PARTE_DIARIO_REASONING_EFFORT")
    if selected_effort is None and selected_model == DEFAULT_PARTE_DIARIO_MODEL:
        selected_effort = DEFAULT_PARTE_DIARIO_REASONING_EFFORT
    return selected_model, selected_effort
