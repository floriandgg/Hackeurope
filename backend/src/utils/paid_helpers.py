"""
Helpers Paid.ai — Facturation agentique (Outcome Pricing).

Chaque agent (2, 3, 4) émet UN signal à la fin de son exécution.
Les signaux incluent api_compute_cost_eur et agent_gross_margin_percent
pour montrer le ROI (valeur facturée vs coût réel).
"""

import os
import uuid
from paid import Paid
from dotenv import load_dotenv

load_dotenv()

# Initialisation du client Paid
PAID_API_KEY = os.getenv("PAID_API_KEY")
paid_client = Paid(token=PAID_API_KEY) if PAID_API_KEY else None

# Constantes du produit
EXTERNAL_PRODUCT_ID = "pr-crisis-swarm-001"

# Tarifs de référence
CONSULTING_HOUR_RATE_EUR = 150
BASE_AUDIT_FEE_EUR = 500
AUDIT_RISK_PERCENT = 0.0001  # 0.01% du risque financier
CRISIS_STRATEGY_FEE_EUR = 2500.00


def _send_signal(signal: dict, agent_name: str) -> bool:
    """Envoie un signal à Paid.ai. Retourne True si succès."""
    if not paid_client:
        print(f"⚠️ [PAID.AI] Client non configuré (PAID_API_KEY manquante). Signal ignoré: {agent_name}")
        return False
    try:
        paid_client.signals.create_signals(signals=[signal])
        return True
    except Exception as e:
        print(f"❌ [PAID.AI] Erreur {agent_name}: {e}")
        return False


def emit_agent2_signal(
    customer_external_id: str,
    crisis_id: str,
    past_cases: list,
    global_lesson: str,
    api_compute_cost_eur: float,
) -> None:
    """
    Agent 2 — Le Stratège Historique.
    Business Outcome : Précédents trouvés = heures de consulting économisées.
    """
    cases_count = len(past_cases)
    hours_saved = cases_count * 3  # 3h de consulting par cas
    consulting_value = hours_saved * CONSULTING_HOUR_RATE_EUR

    gross_margin_percent = (
        ((consulting_value - api_compute_cost_eur) / consulting_value) * 100
        if consulting_value > 0
        else 0.0
    )

    signal = {
        "event_name": "historical_precedents_extracted",
        "customer": {"external_customer_id": customer_external_id},
        "attribution": {"external_product_id": EXTERNAL_PRODUCT_ID},
        "idempotency_key": f"agent2_{crisis_id}_{uuid.uuid4().hex[:6]}",
        "data": {
            "cases_found": cases_count,
            "estimated_hours_saved": hours_saved,
            "human_equivalent_value_eur": consulting_value,
            "api_compute_cost_eur": api_compute_cost_eur,
            "agent_gross_margin_percent": round(gross_margin_percent, 2),
            "key_lesson": (global_lesson or "")[:100],
        },
    }

    if _send_signal(signal, "AGENT 2"):
        print(
            f"✅ [PAID.AI - AGENT 2] Signal envoyé. Valeur : {consulting_value}€ "
            f"(Coût API: {api_compute_cost_eur}€, Marge: {gross_margin_percent:.2f}%)."
        )


def emit_agent3_signal(
    customer_external_id: str,
    crisis_id: str,
    estimated_financial_loss: float,
    severity_score: int,
    api_compute_cost_eur: float,
) -> None:
    """
    Agent 3 — L'Estimateur d'Impact (Risk Assessment).
    Business Outcome : Modélisation de l'impact financier.
    Fee = base 500€ + 0.01% du risque.
    """
    audit_fee_eur = BASE_AUDIT_FEE_EUR + (estimated_financial_loss * AUDIT_RISK_PERCENT)
    audit_fee_eur = round(audit_fee_eur, 2)

    gross_margin_percent = (
        ((audit_fee_eur - api_compute_cost_eur) / audit_fee_eur) * 100
        if audit_fee_eur > 0
        else 0.0
    )

    signal = {
        "event_name": "risk_assessment_completed",
        "customer": {"external_customer_id": customer_external_id},
        "attribution": {"external_product_id": EXTERNAL_PRODUCT_ID},
        "idempotency_key": f"agent3_{crisis_id}_{uuid.uuid4().hex[:6]}",
        "data": {
            "severity_score_1_to_5": severity_score,
            "estimated_financial_exposure": estimated_financial_loss,
            "audit_fee_eur": audit_fee_eur,
            "audit_type": "Automated Financial Exposure Assessment",
            "human_equivalent_value_eur": audit_fee_eur,
            "api_compute_cost_eur": api_compute_cost_eur,
            "agent_gross_margin_percent": round(gross_margin_percent, 2),
        },
    }

    if _send_signal(signal, "AGENT 3"):
        print(
            f"✅ [PAID.AI - AGENT 3] Signal envoyé. Valeur : {audit_fee_eur}€ "
            f"(Coût API: {api_compute_cost_eur}€, Marge: {gross_margin_percent:.2f}%)."
        )


def emit_agent4_signal(
    customer_external_id: str,
    crisis_id: str,
    recommended_strategy_name: str,
    drafts_generated: int,
    api_compute_cost_eur: float,
) -> None:
    """
    Agent 4 — Le Stratège Exécutif.
    Business Outcome : Plan de crise complet (livrable premium).
    Ne doit émettre que si les stratégies ont été générées avec succès.
    """
    crisis_management_fee = CRISIS_STRATEGY_FEE_EUR

    gross_margin_percent = (
        ((crisis_management_fee - api_compute_cost_eur) / crisis_management_fee) * 100
        if crisis_management_fee > 0
        else 0.0
    )

    signal = {
        "event_name": "crisis_strategy_delivered",
        "customer": {"external_customer_id": customer_external_id},
        "attribution": {"external_product_id": EXTERNAL_PRODUCT_ID},
        "idempotency_key": f"agent4_{crisis_id}_{uuid.uuid4().hex[:6]}",
        "data": {
            "recommended_strategy": recommended_strategy_name,
            "assets_drafted": drafts_generated,
            "strategy_fee_eur": crisis_management_fee,
            "deliverable_type": "Full Crisis Mitigation Plan",
            "human_equivalent_value_eur": crisis_management_fee,
            "api_compute_cost_eur": api_compute_cost_eur,
            "agent_gross_margin_percent": round(gross_margin_percent, 2),
        },
    }

    if _send_signal(signal, "AGENT 4"):
        print(
            f"✅ [PAID.AI - AGENT 4] Signal envoyé. Valeur : {crisis_management_fee}€ "
            f"(Coût API: {api_compute_cost_eur}€, Marge: {gross_margin_percent:.2f}%)."
        )
