"""
Paid.ai helpers — Agentic billing (Outcome Pricing).

Each agent (2, 3, 4) emits ONE signal at the end of execution.
Signals include api_compute_cost_eur and agent_gross_margin_percent
to show ROI (invoiced value vs actual cost).
"""

import os
import uuid
from pathlib import Path
try:
    from paid import Paid, Signal, CustomerByExternalId, ProductByExternalId
except ImportError:
    Paid = None  # type: ignore[assignment,misc]
    Signal = None  # type: ignore[assignment,misc]
    CustomerByExternalId = None  # type: ignore[assignment,misc]
    ProductByExternalId = None  # type: ignore[assignment,misc]
from dotenv import load_dotenv

# Load .env (cwd, backend/, project root)
_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[2] / ".env"
_env_root = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

# Paid client initialization
PAID_API_KEY = os.getenv("PAID_API_KEY")
paid_client = Paid(token=PAID_API_KEY) if (Paid is not None and PAID_API_KEY) else None

# Product constants
EXTERNAL_PRODUCT_ID = "pr-crisis-swarm-001"

# Tier-based pricing (pitch-ready)
TIER_PRICING: dict[str, dict] = {
    "IGNORE": {"name": "Dismissed",     "price": 99.0,   "label": "Fausse Alerte"},
    "SOFT":   {"name": "Dismissed",     "price": 99.0,   "label": "Fausse Alerte"},
    "MEDIUM": {"name": "Shield",        "price": 999.0,  "label": "Crise Modérée"},
    "CRITICAL":{"name": "Full Defense", "price": 2499.0, "label": "Crise Majeure"},
}

def get_tier(alert_level: str) -> dict:
    """Return tier info for the given alert level."""
    return TIER_PRICING.get(alert_level.upper(), TIER_PRICING["MEDIUM"])

# Reference rates (used for per-agent breakdown / consulting comparison)
CONSULTING_HOUR_RATE_EUR = 150
BASE_AUDIT_FEE_EUR = 500
AUDIT_RISK_PERCENT = 0.0001
CRISIS_STRATEGY_FEE_EUR = 2500.00


def _build_signal(
    event_name: str,
    customer_external_id: str,
    idempotency_key: str,
    data: dict,
) -> "Signal":
    """Build a typed Signal object for the Paid API."""
    return Signal(
        event_name=event_name,
        customer=CustomerByExternalId(external_customer_id=customer_external_id),
        attribution=ProductByExternalId(external_product_id=EXTERNAL_PRODUCT_ID),
        idempotency_key=idempotency_key,
        data=data,
    )


def _send_signal(signal, agent_name: str) -> bool:
    """Sends a signal to Paid.ai. Returns True on success."""
    if not paid_client:
        print(f"[PAID.AI] Client not configured (PAID_API_KEY missing). Signal ignored: {agent_name}")
        return False
    try:
        paid_client.signals.create_signals(signals=[signal])
        return True
    except Exception as e:
        print(f"[PAID.AI] Error {agent_name}: {e}")
        return False


def emit_agent2_signal(
    customer_external_id: str,
    crisis_id: str,
    past_cases: list,
    global_lesson: str,
    api_compute_cost_eur: float,
    alert_level: str = "MEDIUM",
) -> None:
    """Agent 2 — Historical Strategist."""
    tier = get_tier(alert_level)
    cases_count = len(past_cases)
    hours_saved = cases_count * 3
    consulting_value = hours_saved * CONSULTING_HOUR_RATE_EUR

    signal = _build_signal(
        event_name="historical_precedents_extracted",
        customer_external_id=customer_external_id,
        idempotency_key=f"agent2_{crisis_id}_{uuid.uuid4().hex[:6]}",
        data={
            "tier": tier["name"],
            "tier_price_eur": tier["price"],
            "cases_found": cases_count,
            "estimated_hours_saved": hours_saved,
            "human_equivalent_value_eur": consulting_value,
            "api_compute_cost_eur": api_compute_cost_eur,
            "key_lesson": (global_lesson or "")[:100],
        },
    )

    if _send_signal(signal, "AGENT 2"):
        print(
            f"[PAID.AI - AGENT 2] Signal sent. Tier: {tier['name']} (€{tier['price']}), "
            f"Consulting equiv: €{consulting_value} (API cost: €{api_compute_cost_eur})."
        )


def emit_agent3_signal(
    customer_external_id: str,
    crisis_id: str,
    estimated_financial_loss: float,
    severity_score: int,
    api_compute_cost_eur: float,
    alert_level: str = "MEDIUM",
) -> None:
    """Agent 3 — Impact Estimator (Risk Assessment)."""
    tier = get_tier(alert_level)
    audit_fee_eur = round(BASE_AUDIT_FEE_EUR + (estimated_financial_loss * AUDIT_RISK_PERCENT), 2)

    signal = _build_signal(
        event_name="risk_assessment_completed",
        customer_external_id=customer_external_id,
        idempotency_key=f"agent3_{crisis_id}_{uuid.uuid4().hex[:6]}",
        data={
            "tier": tier["name"],
            "tier_price_eur": tier["price"],
            "severity_score_1_to_5": severity_score,
            "estimated_financial_exposure": estimated_financial_loss,
            "audit_fee_eur": audit_fee_eur,
            "human_equivalent_value_eur": audit_fee_eur,
            "api_compute_cost_eur": api_compute_cost_eur,
        },
    )

    if _send_signal(signal, "AGENT 3"):
        print(
            f"[PAID.AI - AGENT 3] Signal sent. Tier: {tier['name']} (€{tier['price']}), "
            f"Audit equiv: €{audit_fee_eur} (API cost: €{api_compute_cost_eur})."
        )


def emit_agent4_signal(
    customer_external_id: str,
    crisis_id: str,
    recommended_strategy_name: str,
    drafts_generated: int,
    api_compute_cost_eur: float,
    alert_level: str = "MEDIUM",
) -> None:
    """Agent 4 — Executive Strategist."""
    tier = get_tier(alert_level)

    signal = _build_signal(
        event_name="crisis_strategy_delivered",
        customer_external_id=customer_external_id,
        idempotency_key=f"agent4_{crisis_id}_{uuid.uuid4().hex[:6]}",
        data={
            "tier": tier["name"],
            "tier_price_eur": tier["price"],
            "recommended_strategy": recommended_strategy_name,
            "assets_drafted": drafts_generated,
            "strategy_fee_eur": CRISIS_STRATEGY_FEE_EUR,
            "human_equivalent_value_eur": CRISIS_STRATEGY_FEE_EUR,
            "api_compute_cost_eur": api_compute_cost_eur,
        },
    )

    if _send_signal(signal, "AGENT 4"):
        print(
            f"[PAID.AI - AGENT 4] Signal sent. Tier: {tier['name']} (€{tier['price']}), "
            f"Strategy equiv: €{CRISIS_STRATEGY_FEE_EUR} (API cost: €{api_compute_cost_eur})."
        )


# ---------------------------------------------------------------------------
# Checkout (order-based) — creates customer + order in Paid.ai
# ---------------------------------------------------------------------------

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def create_checkout(
    customer_email: str,
    company_name: str,
    tier_name: str,
    tier_price_eur: float,
    crisis_id: str,
) -> dict:
    """
    Create a customer and an order in Paid.ai for the given crisis tier.
    Returns {"order_id": ..., "customer_id": ...} on success.
    """
    if not paid_client:
        print("[PAID.AI] Client not configured — checkout skipped.")
        return {"error": "Paid.ai client not configured", "order_id": None}

    try:
        customer_ext_id = f"crisis_{crisis_id}_{uuid.uuid4().hex[:6]}"

        customer = paid_client.customers.create_customer(
            name=company_name,
            email=customer_email,
            external_id=customer_ext_id,
            metadata={"source": "crisis-pr-agent", "tier": tier_name},
        )
        customer_id = customer.id
        print(f"[PAID.AI] Customer created: {customer_id} ({customer_ext_id})")

        order = paid_client.orders.create_order(
            customer_id=customer_id,
            name=f"Crisis PR — {tier_name} (EUR{tier_price_eur:.0f})",
            external_id=f"order_{crisis_id}_{uuid.uuid4().hex[:6]}",
            metadata={
                "tier": tier_name,
                "price_eur": tier_price_eur,
                "company": company_name,
            },
        )
        order_id = order.id
        print(f"[PAID.AI] Order created: {order_id}")

        return {
            "order_id": order_id,
            "customer_id": customer_id,
            "customer_external_id": customer_ext_id,
        }

    except Exception as e:
        print(f"[PAID.AI] Checkout error: {e}")
        return {"error": str(e), "order_id": None}
