"""Configuration lookup for provider accounts."""

from __future__ import annotations

from uuid import NAMESPACE_URL, uuid5

from sqlmodel import Session, select

from .errors import ChannelConfigurationError


META_ACCESS_TOKEN_SETTING = "channels.meta.access_token"
META_PHONE_NUMBER_ID_SETTING = "channels.meta.phone_number_id"
META_WEBHOOK_VERIFY_TOKEN_SETTING = "channels.meta.webhook_verify_token"
CHANNELS_INTERNAL_TOKEN_SETTING = "channels.internal_token"


def _stable_meta_account_ref(phone_number_id: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"meta:phone-number:{phone_number_id}"))


def _setting_value(session: Session, key: str) -> str | None:
    from app.models import Setting

    setting = session.exec(
        select(Setting)
        .where(Setting.deleted_at.is_(None))
        .where(Setting.clave == key)
        .limit(1)
    ).first()
    if not setting:
        return None
    value = (setting.valor or "").strip()
    return value or None


class MetaAccountConfig:
    def __init__(self, *, access_token: str, phone_number_id: str) -> None:
        self.access_token = access_token
        self.phone_number_id = phone_number_id


class MetaAccountResolver:
    def resolve(self, session: Session, account_ref: str) -> MetaAccountConfig:
        access_token = _setting_value(session, META_ACCESS_TOKEN_SETTING)
        phone_number_id = _setting_value(session, META_PHONE_NUMBER_ID_SETTING)

        if not access_token:
            raise ChannelConfigurationError(f"Falta configurar {META_ACCESS_TOKEN_SETTING} en settings")
        if not phone_number_id:
            raise ChannelConfigurationError(f"Falta configurar {META_PHONE_NUMBER_ID_SETTING} en settings")

        return MetaAccountConfig(access_token=access_token, phone_number_id=phone_number_id)

    def resolve_account_ref_by_phone_number_id(self, session: Session, phone_number_id: str) -> str | None:
        configured_phone_number_id = _setting_value(session, META_PHONE_NUMBER_ID_SETTING)
        if configured_phone_number_id and configured_phone_number_id == str(phone_number_id or "").strip():
            return _stable_meta_account_ref(configured_phone_number_id)
        return None

    def resolve_webhook_verify_token(self, session: Session) -> str | None:
        return _setting_value(session, META_WEBHOOK_VERIFY_TOKEN_SETTING)

    def resolve_internal_token(self, session: Session) -> str | None:
        return _setting_value(session, CHANNELS_INTERNAL_TOKEN_SETTING) or self.resolve_webhook_verify_token(session)


meta_account_resolver = MetaAccountResolver()
