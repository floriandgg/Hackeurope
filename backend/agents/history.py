"""
Historical Precedent Agent: Finds similar past crises and how companies responded.
Person 2: Prompts + search.
"""
from __future__ import annotations

from typing import Any


def run_history(input_text: str, recon_data: dict, search_results: list[dict] | None = None) -> dict[str, Any]:
    """Returns data shape for phase 'history' (precedents list)."""
    # TODO: Person 2 — search + Claude; output precedents[]
    return {"precedents": []}
