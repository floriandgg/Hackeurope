"""
State partagé entre les nœuds du graphe LangGraph.

Clés obligatoires pour Paid.ai (à définir dès l'Agent 1) :
- customer_id : external_id du client dans le dashboard Paid.ai (ex: "acme_123")
- crisis_id   : UUID de la session de crise (pour idempotency_key)
"""

from typing import TypedDict, Any


class GraphState(TypedDict, total=False):
    """State typé du graphe."""

    # Input utilisateur
    company_name: str

    # Paid.ai — obligatoires dès Agent 1
    customer_id: str  # external_customer_id Paid.ai
    crisis_id: str    # UUID unique par run (généré par Agent 1)

    # Agent 1 — chaque article contient : title, url, content, pub_date,
    # authority_score, severity_score, recency_multiplier, exposure_score
    articles: list[dict[str, Any]]

    # Agent 2
    precedents: list[dict[str, Any]]
    global_lesson: str

    # Agent 3
    scores: dict[str, Any]  # Reach, Churn Risk, VaR, severity_score, estimated_financial_loss
    estimated_financial_loss: float
    severity_score: int

    # Agent 4
    strategy_report: dict[str, Any]
    recommended_strategy_name: str
    drafts_generated: int

    # Coûts API par agent (pour Paid.ai)
    agent2_api_cost_eur: float
    agent3_api_cost_eur: float
    agent4_api_cost_eur: float
