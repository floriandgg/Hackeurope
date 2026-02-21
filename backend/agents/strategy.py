"""
Strategy Agent: Generates 3 strategies (Own It / Reframe / Hold the Line) with risk and best_when.
Person 2: Prompts.
"""
from __future__ import annotations

from typing import Any


def run_strategy(input_text: str, recon_data: dict, history_data: dict) -> dict[str, Any]:
    """Returns data shape for phase 'strategy' (strategies list)."""
    # TODO: Person 2 — Claude; output strategies[]
    return {"strategies": []}
