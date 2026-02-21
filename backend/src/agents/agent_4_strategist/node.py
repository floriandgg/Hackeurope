"""
LangGraph Node: Agent 4 — The Strategist (Executive Strategist).

Decision tree, report, posts, press release, internal email.
Emits a Paid.ai signal ONLY if strategies were generated successfully.
"""
from src.graph.state import GraphState
from src.utils.paid_helpers import emit_agent4_signal


def strategist_node(state: GraphState) -> dict:
    """
    Agent 4: decision tree, 3 strategies, drafts.
    One Paid.ai signal per business outcome (premium deliverable).
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    precedents = state.get("precedents", [])
    scores = state.get("scores", {})

    # TODO: Generate 3 strategies, drafts (press release, email, tweet)
    strategy_report: dict = {}
    recommended_strategy_name = ""
    drafts: list = []  # e.g. [press_release, internal_email, tweet]

    success = bool(recommended_strategy_name and drafts)

    # TODO: Track API costs (LLM tokens) for this node
    api_compute_cost_eur = state.get("agent4_api_cost_eur", 0.12)

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
