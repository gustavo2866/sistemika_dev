"""Resolucion de la modalidad operativa global con prioridad de setting sobre variable de entorno."""

from __future__ import annotations

import os
from enum import Enum

from sqlmodel import Session, select

from app.models import Setting


#region Constantes y enum de modalidad
# Agrupa el vocabulario comun para describir el modo operativo del agente.

class ChatAgentMode(str, Enum):
    """Enumera las modalidades operativas disponibles del agente."""

    MANUAL = "manual"
    AUTOMATIC = "automatic"


CHAT_AGENT_MODE_SETTING_KEY = "crm_chat_agent_mode"
"""Clave persistida en settings para la modalidad global del agente."""

CHAT_AGENT_MODE_SETTING_DESCRIPTION = "Modalidad operativa global del agente de chat CRM."
"""Descripcion persistida junto al setting de modalidad del agente."""

#endregion


#region Resolucion de modalidad
# Agrupa helpers para parsear, resolver y persistir la modalidad del agente.

def parse_chat_agent_mode(raw_value: str | None) -> ChatAgentMode | None:
    """Parsea un string libre a `ChatAgentMode` si el valor es valido."""
    if raw_value is None:
        return None
    normalized = str(raw_value).strip().lower()
    if not normalized:
        return None
    try:
        return ChatAgentMode(normalized)
    except ValueError:
        return None


def get_env_chat_agent_mode() -> tuple[ChatAgentMode, str]:
    """Resuelve la modalidad a partir de la variable de entorno y su fuente."""
    raw_value = os.getenv("CRM_CHAT_AGENT_MODE")
    parsed = parse_chat_agent_mode(raw_value)
    if parsed is not None:
        return parsed, "env"
    return ChatAgentMode.MANUAL, "default"


def get_chat_agent_mode(session: Session | None = None) -> ChatAgentMode:
    """Devuelve solo la modalidad efectiva del agente."""
    mode, _ = resolve_chat_agent_mode(session)
    return mode


def resolve_chat_agent_mode(session: Session | None = None) -> tuple[ChatAgentMode, str]:
    """Resuelve la modalidad efectiva y la fuente desde la que fue obtenida."""
    if session is not None:
        setting = session.exec(
            select(Setting)
            .where(Setting.deleted_at.is_(None))
            .where(Setting.clave == CHAT_AGENT_MODE_SETTING_KEY)
            .limit(1)
        ).first()
        parsed = parse_chat_agent_mode(setting.valor if setting else None)
        if parsed is not None:
            return parsed, "setting"

    return get_env_chat_agent_mode()


def save_chat_agent_mode(session: Session, mode: ChatAgentMode) -> Setting:
    """Persiste la modalidad global del agente en la tabla de settings."""
    setting = session.exec(
        select(Setting)
        .where(Setting.deleted_at.is_(None))
        .where(Setting.clave == CHAT_AGENT_MODE_SETTING_KEY)
        .limit(1)
    ).first()

    if setting is None:
        setting = Setting(
            clave=CHAT_AGENT_MODE_SETTING_KEY,
            valor=mode.value,
            descripcion=CHAT_AGENT_MODE_SETTING_DESCRIPTION,
        )
    else:
        setting.valor = mode.value
        setting.descripcion = CHAT_AGENT_MODE_SETTING_DESCRIPTION

    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting


def should_auto_process(mode: ChatAgentMode | None = None, session: Session | None = None) -> bool:
    """Indica si la modalidad efectiva debe procesar automaticamente por webhook."""
    resolved_mode = mode or get_chat_agent_mode(session)
    return resolved_mode == ChatAgentMode.AUTOMATIC

#endregion
