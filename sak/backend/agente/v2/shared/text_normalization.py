from __future__ import annotations

import re
import unicodedata
from typing import Any


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().lower().split())


def normalize_text_without_accents(value: Any) -> str:
    normalized = unicodedata.normalize("NFD", normalize_text(value))
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def tokenize_text(value: Any) -> set[str]:
    normalized = normalize_text_without_accents(value)
    return {token for token in re.findall(r"[a-z0-9]+", normalized) if len(token) > 1}

