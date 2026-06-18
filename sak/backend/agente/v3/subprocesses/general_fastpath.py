"""Fast paths conservadores para el subproceso general v3."""

from __future__ import annotations

import re
import unicodedata


_GREETING_PHRASES = (
    ("buenas", "tardes"),
    ("buenas", "noches"),
    ("buenos", "dias"),
    ("buen", "dia"),
    ("como", "estas"),
    ("como", "va"),
    ("que", "tal"),
    ("todo", "bien"),
    ("hola",),
    ("buenas",),
)


def normalize_general_command(value: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    raw = "".join(char for char in raw if not unicodedata.combining(char))
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def is_pure_greeting(value: str | None) -> bool:
    command = normalize_general_command(value)
    if not command:
        return True
    tokens = command.split()
    index = 0
    matched_count = 0
    while index < len(tokens):
        matched = next(
            (
                phrase
                for phrase in _GREETING_PHRASES
                if tuple(tokens[index:index + len(phrase)]) == phrase
            ),
            None,
        )
        if matched is None:
            return False
        index += len(matched)
        matched_count += 1
    return matched_count > 0
