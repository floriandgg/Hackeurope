"""
Recon Agent: Scrapes/searches crisis source, extracts brief (company, severity, stakeholders, sentiment).
Person 2: Prompts + Tavily/search integration.
"""
from __future__ import annotations

from typing import Any


def run_recon(input_text: str, search_results: list[dict] | None = None) -> dict[str, Any]:
    """
    Returns data shape for phase 'recon' (see docs/API_CONTRACT.md).
    search_results: optional list from Tavily/Serper for Person 2 to integrate.
    """
    # TODO: Person 2 — call Claude with recon prompt; parse JSON; optionally use search_results
    return {
        "company": "",
        "crisis_type": "",
        "severity": 0.0,
        "virality": "high",
        "summary": "",
        "key_facts": [],
        "stakeholders": [],
        "sentiment": {"overall_score": 0.0, "label": ""},
    }
