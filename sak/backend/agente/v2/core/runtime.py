from __future__ import annotations

import os
from enum import Enum

from sqlmodel import Session, select

from app.models import Setting


class ChatAgentMode(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    HYBRID = "hybrid"


CHAT_AGENT_MODE_SETTING_KEY = "crm_chat_agent_mode"
CHAT_AGENT_MODE_SETTING_DESCRIPTION = "Modalidad operativa global del agente de chat CRM."


def parse_chat_agent_mode(raw_value: str | None) -> ChatAgentMode | None:
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
    raw_value = os.getenv("CRM_CHAT_AGENT_MODE")
    parsed = parse_chat_agent_mode(raw_value)
    if parsed is not None:
        return parsed, "env"
    return ChatAgentMode.MANUAL, "default"


def get_chat_agent_mode(session: Session | None = None) -> ChatAgentMode:
    mode, _ = resolve_chat_agent_mode(session)
    return mode


def resolve_chat_agent_mode(session: Session | None = None) -> tuple[ChatAgentMode, str]:
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
    resolved_mode = mode or get_chat_agent_mode(session)
    return resolved_mode in {ChatAgentMode.AUTOMATIC, ChatAgentMode.HYBRID}
