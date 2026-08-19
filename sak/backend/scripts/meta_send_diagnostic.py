"""Send a diagnostic WhatsApp message through Meta and print the raw response.

Usage:
    python scripts/meta_send_diagnostic.py 5493816976725
    python scripts/meta_send_diagnostic.py 5493816976725 --preserve-argentina-9
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime
from typing import Any

import httpx
from sqlmodel import Session

from app.db import engine
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.utils import normalize_phone_for_meta


def _normalize_preserving_argentina_9(phone: str) -> str:
    phone_clean = str(phone).strip().lstrip("+")
    return f"+{phone_clean}"


def _redact_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return dict(payload)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send a Meta WhatsApp diagnostic message and print the full Graph response."
    )
    parser.add_argument("phone", help="Destination phone, for example 5493816976725")
    parser.add_argument(
        "--body",
        default=f"Diagnostico SAK Meta {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        help="Message body to send.",
    )
    parser.add_argument(
        "--preserve-argentina-9",
        action="store_true",
        help="Send to +549... instead of applying the current production normalizer.",
    )
    args = parser.parse_args()

    to_phone = (
        _normalize_preserving_argentina_9(args.phone)
        if args.preserve_argentina_9
        else normalize_phone_for_meta(args.phone)
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": args.body},
    }

    with Session(engine) as session:
        config = meta_account_resolver.resolve(session, "")

    url = f"https://graph.facebook.com/v22.0/{config.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
    }

    print("PHONE_NUMBER_ID=", config.phone_number_id)
    print("REQUEST_URL=", url)
    print("REQUEST_PAYLOAD=", _redact_payload(payload))

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)

    print("RESPONSE_STATUS=", response.status_code)
    print("RESPONSE_HEADERS_CONTENT_TYPE=", response.headers.get("content-type"))
    print("RESPONSE_BODY=", response.text)
    return 0 if response.is_success else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
