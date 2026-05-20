"""Technical persistence for provider events."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel, Session, select

from .types import ChannelEventData
from .utils import normalize_address, normalize_provider_datetime


def current_utc_time() -> datetime:
    return datetime.now(UTC)


class ChannelEvent(SQLModel, table=True):
    __tablename__ = "channel_events"
    __searchable_fields__ = ["provider", "channel_type", "account_ref", "external_message_id"]

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=current_utc_time, nullable=False)
    updated_at: datetime = Field(default_factory=current_utc_time, nullable=False)
    deleted_at: datetime | None = Field(default=None, nullable=True)
    version: int = Field(default=1, nullable=False)

    provider: str = Field(max_length=50, index=True, nullable=False)
    channel_type: str = Field(max_length=50, index=True, nullable=False)
    account_ref: str = Field(max_length=255, index=True, nullable=False)
    external_account_id: str | None = Field(default=None, max_length=255, index=True)
    direction: str = Field(max_length=30, index=True, nullable=False)
    from_address: str | None = Field(default=None, max_length=255, index=True)
    to_address: str | None = Field(default=None, max_length=255, index=True)
    external_message_id: str | None = Field(default=None, max_length=255, index=True)
    external_event_id: str | None = Field(default=None, max_length=255, index=True)
    status: str | None = Field(default=None, max_length=50, index=True)
    occurred_at: datetime = Field(default_factory=current_utc_time, index=True, nullable=False)
    raw_payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    normalized_payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class ChannelEventStore:
    def record(self, session: Session, event: ChannelEventData) -> ChannelEvent:
        existing = None
        if event.external_message_id and event.direction == "inbound":
            existing = session.exec(
                select(ChannelEvent)
                .where(ChannelEvent.provider == event.provider)
                .where(ChannelEvent.channel_type == event.channel_type)
                .where(ChannelEvent.direction == event.direction)
                .where(ChannelEvent.external_message_id == event.external_message_id)
                .limit(1)
            ).first()
        if existing:
            return existing

        row = ChannelEvent(
            provider=event.provider,
            channel_type=event.channel_type,
            account_ref=event.account_ref,
            external_account_id=event.external_account_id,
            direction=event.direction,
            from_address=normalize_address(event.from_address),
            to_address=normalize_address(event.to_address),
            external_message_id=event.external_message_id,
            external_event_id=event.external_event_id,
            status=event.status,
            occurred_at=normalize_provider_datetime(event.occurred_at) or current_utc_time(),
            raw_payload=event.raw_payload or {},
            normalized_payload=event.normalized_payload or {},
        )
        session.add(row)
        session.flush()
        return row

    def has_recent_inbound(
        self,
        session: Session,
        *,
        provider: str,
        channel_type: str,
        account_ref: str,
        contact_address: str,
        now: datetime | None = None,
        window: timedelta = timedelta(hours=24),
    ) -> bool:
        now_utc = normalize_provider_datetime(now) or current_utc_time()
        contact = normalize_address(contact_address)
        if not contact:
            return False

        row = session.exec(
            select(ChannelEvent)
            .where(ChannelEvent.provider == provider)
            .where(ChannelEvent.channel_type == channel_type)
            .where(ChannelEvent.account_ref == account_ref)
            .where(ChannelEvent.direction == "inbound")
            .where(ChannelEvent.from_address == contact)
            .order_by(ChannelEvent.occurred_at.desc())
            .limit(1)
        ).first()
        if not row:
            return False

        occurred_at = row.occurred_at
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=UTC)
        return now_utc - occurred_at.astimezone(UTC) <= window


channel_event_store = ChannelEventStore()
