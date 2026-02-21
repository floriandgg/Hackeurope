"""
LangGraph multi-agent pipeline: Recon → History → Strategy → Drafting → Costing.
Person 1 (Architect): State machine, node wiring, WebSocket push.
"""
from __future__ import annotations

from typing import Any, Callable

# from langgraph.graph import StateGraph  # uncomment when using LangGraph

PHASES = ["recon", "history", "strategy", "drafting", "costing"]


def run_pipeline_sync(input_text: str, session_id: str, push_message: Callable) -> dict[str, Any]:
    """
    Run the full pipeline and call push_message(phase, status, cost, data) for each update.
    Person 1 implements; Person 2 provides agent runners.
    """
    report = {}
    # TODO: Build LangGraph with 5 nodes; each node:
    #   1. push_message(phase, "started", ...)
    #   2. result = run_agent_*(input_text, report)
    #   3. report[phase] = result
    #   4. push_message(phase, "complete", cost, result)
    #   5. pass report to next node
    return report
