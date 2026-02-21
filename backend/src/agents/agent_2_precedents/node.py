"""
LangGraph Node: Agent 2 — Precedents (Historical Strategist).

Searches for similar cases via Tavily.
Emits a Paid.ai signal at the end (historical_precedents_extracted).
"""
from src.graph.state import GraphState
from src.utils.paid_helpers import emit_agent2_signal


def precedents_node(state: GraphState) -> dict:
    """
    Agent 2: searches for similar situations.
    One Paid.ai signal per business outcome.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    articles = state.get("articles", [])

    # TODO: Tavily search, extract past_cases and global_lesson
    past_cases: list = []  # placeholder: list of similar cases found
    global_lesson: str = ""  # placeholder: synthetic lesson

    # TODO: Track API costs (Tavily + LLM) for this node
    # Ex: via get_openai_callback, LangSmith, ou compteur manuel
    api_compute_cost_eur = state.get("agent2_api_cost_eur", 0.04)

    # Send Paid.ai signal BEFORE return
    emit_agent2_signal(
        customer_external_id=customer_id,
        crisis_id=crisis_id,
        past_cases=past_cases,
        global_lesson=global_lesson,
        api_compute_cost_eur=api_compute_cost_eur,
    )

    return {
        "precedents": past_cases,
        "global_lesson": global_lesson,
    }
