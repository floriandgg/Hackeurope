"""
Nœud LangGraph : Agent 2 — Precedents (Stratège Historique).

Recherche cas similaires via Tavily.
Émet un signal Paid.ai à la fin (historical_precedents_extracted).
"""
from src.graph.state import GraphState
from src.utils.paid_helpers import emit_agent2_signal


def precedents_node(state: GraphState) -> dict:
    """
    Agent 2 : recherche situations similaires.
    Un signal Paid.ai par business outcome (One Signal Per Business Outcome).
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    articles = state.get("articles", [])

    # TODO: Recherche Tavily, extraction past_cases et global_lesson
    past_cases: list = []  # placeholder : liste de cas similaires trouvés
    global_lesson: str = ""  # placeholder : leçon synthétique

    # TODO: Tracker les coûts API (Tavily + LLM) pour ce nœud
    # Ex: via get_openai_callback, LangSmith, ou compteur manuel
    api_compute_cost_eur = state.get("agent2_api_cost_eur", 0.04)

    # Envoi du signal Paid.ai AVANT le return
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
