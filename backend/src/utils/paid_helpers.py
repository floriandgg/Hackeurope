"""
Paid.ai Helpers — Agentic billing (Outcome Pricing).

Each agent (2, 3, 4) emits ONE signal at the end of its execution.
Signals include api_compute_cost_eur and agent_gross_margin_percent
to demonstrate ROI (billed value vs actual cost).
"""

import os
import uuid
from pathlib import Path
from paid import Paid
from dotenv import load_dotenv

_backend_env = Path(__file__).resolve().parents[2] / ".env"
_root_env = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_backend_env)
load_dotenv(_root_env)

PAID_API_KEY = os.getenv("PAID_API_KEY")
paid_client = Paid(token=PAID_API_KEY) if PAID_API_KEY else None

EXTERNAL_PRODUCT_ID = "pr-crisis-swarm-001"

# Reference pricing
CONSULTING_HOUR_RATE_EUR = 150
BASE_AUDIT_FEE_EUR = 500
AUDIT_RISK_PERCENT = 0.0001  # 0.01% of financial risk
CRISIS_STRATEGY_FEE_EUR = 2500.00


def _send_signal(signal: dict, agent_name: str) -> bool:
    """Send a signal to Paid.ai. Returns True on success."""
    if not paid_client:
        print(f"[PAID.AI] WARNING: Client not configured (PAID_API_KEY missing). Signal skipped: {agent_name}")
        return False
    try:
        paid_client.signals.create_signals(signals=[signal])
        return True
    except Exception as e:
        print(f"[PAID.AI] ERROR {agent_name}: {e}")
        return False


def emit_agent2_signal(
    customer_external_id: str,
    crisis_id: str,
    past_cases: list,
    global_lesson: str,
    api_compute_cost_eur: float,
) -> None:
    """
    Agent 2 — The Historical Strategist.
    Business Outcome: Precedents found = consulting hours saved.
    """
    cases_count = len(past_cases)
    hours_saved = cases_count * 3  # 3h consulting per case
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
            f"[PAID.AI - AGENT 2] Signal sent. Value: {consulting_value} EUR "
            f"(API cost: {api_compute_cost_eur} EUR, Margin: {gross_margin_percent:.2f}%)."
        )


def emit_agent3_signal(
    customer_external_id: str,
    crisis_id: str,
    estimated_financial_loss: float,
    severity_score: int,
    api_compute_cost_eur: float,
) -> None:
    """
    Agent 3 — The Impact Estimator (Risk Assessment).
    Business Outcome: Financial impact modelling.
    Fee = base 500 EUR + 0.01% of financial risk.
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
            f"[PAID.AI - AGENT 3] Signal sent. Value: {audit_fee_eur} EUR "
            f"(API cost: {api_compute_cost_eur} EUR, Margin: {gross_margin_percent:.2f}%)."
        )


def emit_agent4_signal(
    customer_external_id: str,
    crisis_id: str,
    recommended_strategy_name: str,
    drafts_generated: int,
    api_compute_cost_eur: float,
) -> None:
    """
    Agent 4 — The Executive Strategist.
    Business Outcome: Full crisis plan (premium deliverable).
    Only emits if strategies were generated successfully.
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
            f"[PAID.AI - AGENT 4] Signal sent. Value: {crisis_management_fee} EUR "
            f"(API cost: {api_compute_cost_eur} EUR, Margin: {gross_margin_percent:.2f}%)."
        )
