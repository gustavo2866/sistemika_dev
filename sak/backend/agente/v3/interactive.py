"""Helpers para mensajes interactivos de WhatsApp en agente v3."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class InteractiveListRow:
    id: str
    title: str
    description: str | None = None


@dataclass(frozen=True, slots=True)
class InteractiveButton:
    id: str
    title: str


def whatsapp_list(
    *,
    body: str,
    button: str,
    rows: list[InteractiveListRow],
    section_title: str = "Opciones",
) -> dict | None:
    normalized_rows = [
        row
        for row in rows[:10]
        if row.id.strip() and row.title.strip()
    ]
    if not normalized_rows:
        return None
    return {
        "type": "list",
        "body": {"text": _limit(body, 1024)},
        "action": {
            "button": _limit(button, 20),
            "sections": [
                {
                    "title": _limit(section_title, 24),
                    "rows": [
                        {
                            "id": _limit(row.id, 200),
                            "title": _limit(row.title, 24),
                            **(
                                {"description": _limit(row.description, 72)}
                                if row.description
                                else {}
                            ),
                        }
                        for row in normalized_rows
                    ],
                }
            ],
        },
    }


def whatsapp_buttons(
    *,
    body: str,
    buttons: list[InteractiveButton],
) -> dict | None:
    normalized_buttons = [
        button
        for button in buttons[:3]
        if button.id.strip() and button.title.strip()
    ]
    if not normalized_buttons:
        return None
    return {
        "type": "button",
        "body": {"text": _limit(body, 1024)},
        "action": {
            "buttons": [
                {
                    "type": "reply",
                    "reply": {
                        "id": _limit(button.id, 200),
                        "title": _limit(button.title, 20),
                    },
                }
                for button in normalized_buttons
            ],
        },
    }


def _limit(value: str | None, max_length: int) -> str:
    text = str(value or "").strip()
    if len(text) <= max_length:
        return text
    return text[:max_length].rstrip()
