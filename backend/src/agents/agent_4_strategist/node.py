"""
Nœud LangGraph : Agent 4 — The Strategist (Stratège Exécutif).

Arbre de décision, report, posts, communiqué, email interne.
Émet un signal Paid.ai UNIQUEMENT si stratégies générées avec succès.
"""
from src.graph.state import GraphState
from src.utils.paid_helpers import emit_agent4_signal


def strategist_node(state: GraphState) -> dict:
    """
    Agent 4 : arbre décision, 3 stratégies, brouillons.
    Un signal Paid.ai par business outcome (livrable premium).
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    precedents = state.get("precedents", [])
    scores = state.get("scores", {})

    # TODO: Générer 3 stratégies, brouillons (press release, email, tweet)
    strategy_report: dict = {}
    recommended_strategy_name = ""
    drafts: list = []  # ex: [press_release, internal_email, tweet]

    success = bool(recommended_strategy_name and drafts)

    # TODO: Tracker les coûts API (tokens LLM) pour ce nœud
    api_compute_cost_eur = state.get("agent4_api_cost_eur", 0.12)

    # Envoi du signal Paid.ai UNIQUEMENT si livrable généré
    if success:
        emit_agent4_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            recommended_strategy_name=recommended_strategy_name,
            drafts_generated=len(drafts),
            api_compute_cost_eur=api_compute_cost_eur,
        )

    return {
        "strategy_report": strategy_report,
        "recommended_strategy_name": recommended_strategy_name,
        "drafts_generated": len(drafts),
    }
