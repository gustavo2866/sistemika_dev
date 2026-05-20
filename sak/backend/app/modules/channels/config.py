"""Configuration lookup for provider accounts."""

from __future__ import annotations

import os
import re

from sqlmodel import Session, select

from .errors import ChannelConfigurationError


def _env_key_suffix(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").upper()


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
        suffix = _env_key_suffix(account_ref)

        access_token = (
            os.getenv(f"CHANNEL_META_ACCESS_TOKEN_{suffix}")
            or os.getenv("CHANNEL_META_ACCESS_TOKEN")
            or os.getenv("META_ACCESS_TOKEN")
            or _setting_value(session, f"channels.meta.accounts.{account_ref}.access_token")
            or _setting_value(session, "channels.meta.access_token")
            or _setting_value(session, "meta_access_token")
        )
        phone_number_id = (
            os.getenv(f"CHANNEL_META_PHONE_NUMBER_ID_{suffix}")
            or os.getenv("CHANNEL_META_PHONE_NUMBER_ID")
            or os.getenv("META_PHONE_NUMBER_ID")
            or _setting_value(session, f"channels.meta.accounts.{account_ref}.phone_number_id")
            or _setting_value(session, "channels.meta.default_phone_number_id")
            or _setting_value(session, "meta_phone_number_id")
        )

        if not phone_number_id and account_ref.isdigit():
            phone_number_id = account_ref

        if not access_token:
            raise ChannelConfigurationError("Falta configurar CHANNEL_META_ACCESS_TOKEN o META_ACCESS_TOKEN")
        if not phone_number_id:
            raise ChannelConfigurationError(
                "Falta configurar CHANNEL_META_PHONE_NUMBER_ID o el phone_number_id para la cuenta"
            )

        return MetaAccountConfig(access_token=access_token, phone_number_id=phone_number_id)

    def resolve_account_ref_by_phone_number_id(self, session: Session, phone_number_id: str) -> str | None:
        from app.models import Setting

        setting = session.exec(
            select(Setting)
            .where(Setting.deleted_at.is_(None))
            .where(Setting.clave.like("channels.meta.accounts.%.phone_number_id"))
            .where(Setting.valor == phone_number_id)
            .limit(1)
        ).first()
        if not setting:
            return None

        prefix = "channels.meta.accounts."
        suffix = ".phone_number_id"
        if setting.clave.startswith(prefix) and setting.clave.endswith(suffix):
            return setting.clave[len(prefix) : -len(suffix)]
        return None

    def resolve_webhook_verify_token(self, session: Session) -> str | None:
        return (
            os.getenv("CHANNEL_META_WEBHOOK_VERIFY_TOKEN")
            or os.getenv("META_WEBHOOK_VERIFY_TOKEN")
            or _setting_value(session, "channels.meta.webhook_verify_token")
            or _setting_value(session, "meta_webhook_verify_token")
        )


meta_account_resolver = MetaAccountResolver()
