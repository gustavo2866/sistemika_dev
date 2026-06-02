"""Validacion estructural de datasets versionados del agente."""

from __future__ import annotations

import json
from pathlib import Path


EVALS_DIR = Path(__file__).resolve().parents[2] / "agente" / "v2" / "evals"


def test_agent_eval_datasets_are_non_empty_valid_jsonl():
    paths = sorted(EVALS_DIR.glob("*.jsonl"))

    assert paths
    for path in paths:
        lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        assert lines, path.name
        for line in lines:
            item = json.loads(line)
            assert item["input"], path.name
            assert isinstance(item["expected"], dict), path.name
