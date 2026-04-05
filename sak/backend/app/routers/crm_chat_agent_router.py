from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from agente.v2.core.runtime import (
    CHAT_AGENT_MODE_SETTING_KEY,
    ChatAgentMode,
    get_env_chat_agent_mode,
    parse_chat_agent_mode,
    resolve_chat_agent_mode,
    save_chat_agent_mode,
)
from app.db import get_session
from app.models import Setting
from app.models.base import serialize_datetime


router = APIRouter(
    prefix="/crm/chat-agent",
    tags=["crm-chat-agent"],
)


def _load_agent_mode_setting(session: Session) -> Setting | None:
    return session.exec(
        select(Setting)
        .where(Setting.deleted_at.is_(None))
        .where(Setting.clave == CHAT_AGENT_MODE_SETTING_KEY)
        .limit(1)
    ).first()


def _build_config_payload(session: Session) -> dict[str, Any]:
    resolved_mode, source = resolve_chat_agent_mode(session)
    fallback_mode, fallback_source = get_env_chat_agent_mode()
    setting = _load_agent_mode_setting(session)

    return {
        "agent_mode": resolved_mode.value,
        "source": source,
        "allowed_modes": [mode.value for mode in ChatAgentMode],
        "fallback_agent_mode": fallback_mode.value,
        "fallback_source": fallback_source,
        "setting": (
            {
                "id": setting.id,
                "clave": setting.clave,
                "valor": setting.valor,
                "descripcion": setting.descripcion,
                "updated_at": serialize_datetime(setting.updated_at) if setting.updated_at else None,
            }
            if setting is not None
            else None
        ),
    }


@router.get("/config")
def obtener_configuracion_chat_agent(
    session: Session = Depends(get_session),
):
    return _build_config_payload(session)


@router.put("/config")
def guardar_configuracion_chat_agent(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    raw_mode = payload.get("agent_mode") if isinstance(payload, dict) else None
    mode = parse_chat_agent_mode(raw_mode)
    if mode is None:
        raise HTTPException(
            status_code=400,
            detail="agent_mode invalido. Valores permitidos: manual, automatic",
        )

    save_chat_agent_mode(session, mode)
    return _build_config_payload(session)
