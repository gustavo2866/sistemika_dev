"""HTTP client for Meta Graph API."""

from __future__ import annotations

from typing import Any

import httpx


class MetaGraphClient:
    base_url = "https://graph.facebook.com/v22.0"

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def send_message(
        self,
        *,
        access_token: str,
        phone_number_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        response = await self._get_client().post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()

    async def mark_message_read(
        self,
        *,
        access_token: str,
        phone_number_id: str,
        message_id: str,
        show_typing: bool = False,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        if show_typing:
            payload["typing_indicator"] = {"type": "text"}

        url = f"{self.base_url}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        response = await self._get_client().post(url, headers=headers, json=payload, timeout=1.0)
        response.raise_for_status()
        return response.json()


meta_graph_client = MetaGraphClient()

