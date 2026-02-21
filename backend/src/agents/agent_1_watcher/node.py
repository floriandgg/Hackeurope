"""
Nœud LangGraph : Agent 1 — The Watcher.

Collecte articles via Tavily, scoring Exposure, génère crisis_id.
Définit customer_id et crisis_id pour Paid.ai (Agent 2, 3, 4).
"""
import uuid

from src.graph.state import GraphState


def watcher_node(state: GraphState) -> dict:
    """
    Agent 1 : collecte articles, détection anomalies.
    OBLIGATOIRE : injecte customer_id et crisis_id dans le state pour Paid.ai.
    """
    company_name = state.get("company_name", "")
    customer_id = state.get("customer_id") or _derive_customer_id(company_name)
    crisis_id = str(uuid.uuid4())

    # TODO: Appels Tavily, scoring Exposure, top 10 articles
    articles = []  # placeholder

    return {
        "customer_id": customer_id,
        "crisis_id": crisis_id,
        "articles": articles,
    }


def _derive_customer_id(company_name: str) -> str:
    """Dérive un external_customer_id si non fourni (ex: "Tesla" -> "tesla")."""
    return (company_name or "unknown").lower().replace(" ", "_").replace("-", "_")[:64]
