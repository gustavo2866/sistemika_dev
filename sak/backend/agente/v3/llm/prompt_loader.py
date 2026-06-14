"""Utilidades comunes para prompts de agente v3."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


_PROMPT_CACHE: dict[Path, tuple[float, str]] = {}


def load_prompt(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _PROMPT_CACHE.get(path)
    if cached is None or cached[0] != mtime:
        _PROMPT_CACHE[path] = (mtime, path.read_text(encoding="utf-8").strip())
    return _PROMPT_CACHE[path][1]


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
