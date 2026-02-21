"""
Nœud LangGraph : Agent 3 — The Scorer (Estimateur d'Impact).

Calcule Reach, Churn Risk, VaR via Gemini.
Émet un signal Paid.ai à la fin (risk_assessment_completed).
"""
from src.graph.state import GraphState
from src.utils.paid_helpers import emit_agent3_signal


def scorer_node(state: GraphState) -> dict:
    """
    Agent 3 : scoring Reach, Churn Risk, VaR.
    Un signal Paid.ai par business outcome.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    articles = state.get("articles", [])

    # TODO: Appels Gemini, calcul severity_score, estimated_financial_loss
    severity_score = state.get("severity_score", 3)
    estimated_financial_loss = state.get("estimated_financial_loss", 100_000.0)
    scores = {
        "reach": 0,
        "churn_risk": 0.0,
        "var_eur": 0.0,
    }

    # TODO: Tracker les coûts API (tokens Gemini) pour ce nœud
    api_compute_cost_eur = state.get("agent3_api_cost_eur", 0.08)

    # Envoi du signal Paid.ai AVANT le return
    emit_agent3_signal(
        customer_external_id=customer_id,
        crisis_id=crisis_id,
        estimated_financial_loss=estimated_financial_loss,
        severity_score=severity_score,
        api_compute_cost_eur=api_compute_cost_eur,
    )

    return {
        "scores": scores,
        "severity_score": severity_score,
        "estimated_financial_loss": estimated_financial_loss,
    }
