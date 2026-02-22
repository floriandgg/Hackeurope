"""
LangGraph Node: Agent 5 — The CFO.

Aggregates API costs from Agents 2-4, calculates human-equivalent
consulting values, builds a structured invoice with ROI analysis,
and determines if action should be refused (crisis too minor).

No LLM needed — purely computational.
"""
from __future__ import annotations

import time
from typing import Any

from src.graph.state import GraphState
from src.shared.types import Agent5Output, InvoiceLineItem
from src.utils.paid_helpers import (
    CONSULTING_HOUR_RATE_EUR,
    BASE_AUDIT_FEE_EUR,
    AUDIT_RISK_PERCENT,
    CRISIS_STRATEGY_FEE_EUR,
    get_tier,
)


def _build_invoice(
    agent2_api_cost: float,
    agent3_api_cost: float,
    agent4_api_cost: float,
    cases_count: int,
    total_var_impact: float,
    alert_level: str,
) -> Agent5Output:
    """Build the full invoice using tier-based pricing."""

    tier = get_tier(alert_level)
    tier_name = tier["name"]
    tier_label = tier["label"]
    tier_price = tier["price"]
    total_api = round(agent2_api_cost + agent3_api_cost + agent4_api_cost, 4)

    if alert_level == "IGNORE":
        return Agent5Output(
            tier_name=tier_name,
            tier_label=tier_label,
            tier_price_eur=tier_price,
            line_items=[],
            total_human_equivalent_eur=tier_price,
            total_api_cost_eur=total_api,
            total_gross_margin_percent=0.0,
            roi_multiplier=0.0,
            invoice_summary=f"Threat dismissed — {tier_label} tier (€{tier_price:.0f}).",
            trade_off_reasoning=(
                "The AI agents determined this situation does not warrant a crisis response. "
                f"A traditional PR agency would have charged €{CRISIS_STRATEGY_FEE_EUR:,.0f}+ "
                f"just for the initial assessment. Our AI completed the full analysis for €{tier_price:.0f}."
            ),
            action_refused=True,
            refusal_reason=(
                "Alert level is IGNORE — the crisis is too minor to warrant active defense. "
                "Monitoring and analysis delivered at the Dismissed tier rate."
            ),
        )

    # --- Per-agent breakdown (consulting comparison, NOT the billed price) ---
    hours_saved = cases_count * 3
    agent2_consulting = hours_saved * CONSULTING_HOUR_RATE_EUR
    agent3_consulting = round(BASE_AUDIT_FEE_EUR + (total_var_impact * AUDIT_RISK_PERCENT), 2)
    agent4_consulting = CRISIS_STRATEGY_FEE_EUR
    total_consulting = agent2_consulting + agent3_consulting + agent4_consulting

    line_agent2 = InvoiceLineItem(
        agent="Historical Strategist",
        event="historical_precedents_extracted",
        human_equivalent_value_eur=round(agent2_consulting, 2),
        api_compute_cost_eur=round(agent2_api_cost, 4),
        gross_margin_percent=round(
            ((agent2_consulting - agent2_api_cost) / agent2_consulting) * 100
            if agent2_consulting > 0 else 0.0, 2
        ),
        detail=f"{cases_count} cases x 3h x EUR{CONSULTING_HOUR_RATE_EUR}/h",
    )

    line_agent3 = InvoiceLineItem(
        agent="Risk Analyst",
        event="risk_assessment_completed",
        human_equivalent_value_eur=agent3_consulting,
        api_compute_cost_eur=round(agent3_api_cost, 4),
        gross_margin_percent=round(
            ((agent3_consulting - agent3_api_cost) / agent3_consulting) * 100
            if agent3_consulting > 0 else 0.0, 2
        ),
        detail=f"EUR{BASE_AUDIT_FEE_EUR} base + 0.01% of EUR{total_var_impact:,.0f} VaR",
    )

    line_agent4 = InvoiceLineItem(
        agent="Executive Strategist",
        event="crisis_strategy_delivered",
        human_equivalent_value_eur=agent4_consulting,
        api_compute_cost_eur=round(agent4_api_cost, 4),
        gross_margin_percent=round(
            ((agent4_consulting - agent4_api_cost) / agent4_consulting) * 100
            if agent4_consulting > 0 else 0.0, 2
        ),
        detail="Full crisis mitigation plan + communication drafts",
    )

    line_items = [line_agent2, line_agent3, line_agent4]

    tier_margin = (
        ((tier_price - total_api) / tier_price) * 100
        if tier_price > 0 else 0.0
    )
    roi_mult = tier_price / total_api if total_api > 0 else 0.0

    invoice_summary = (
        f"{tier_label} — {tier_name} tier: EUR{tier_price:,.0f}. "
        f"A traditional agency would charge EUR{total_consulting:,.0f} for the same deliverables. "
        f"You save EUR{total_consulting - tier_price:,.0f}."
    )

    trade_off = (
        f"A traditional PR agency would charge EUR{total_consulting:,.0f} for this level of crisis response: "
        f"EUR{agent2_consulting:,.0f} for precedent research ({hours_saved}h of analyst work), "
        f"EUR{agent3_consulting:,.0f} for financial risk assessment, and "
        f"EUR{agent4_consulting:,.0f} for strategy development with communication drafts. "
        f"Crisis PR Agent delivers identical outputs in under 75 seconds "
        f"for EUR{tier_price:,.0f} ({tier_name} tier) — "
        f"that's {total_consulting / tier_price:.0f}x cheaper than a consulting agency."
    )

    return Agent5Output(
        tier_name=tier_name,
        tier_label=tier_label,
        tier_price_eur=tier_price,
        line_items=line_items,
        total_human_equivalent_eur=round(total_consulting, 2),
        total_api_cost_eur=total_api,
        total_gross_margin_percent=round(tier_margin, 2),
        roi_multiplier=round(roi_mult, 1),
        invoice_summary=invoice_summary,
        trade_off_reasoning=trade_off,
        action_refused=False,
        refusal_reason="",
    )


def cfo_node(state: GraphState) -> dict[str, Any]:
    """
    Agent 5 (LangGraph node): aggregates costs from Agents 2-4,
    builds invoice with ROI analysis.
    """
    t0 = time.time()

    agent2_api_cost = state.get("agent2_api_cost_eur", 0.035)
    agent3_api_cost = state.get("agent3_api_cost_eur", 0.08)
    agent4_api_cost = state.get("agent4_api_cost_eur", 0.02)

    # Count precedent cases from state
    precedents = state.get("precedents", [])
    cases_count = len(precedents)

    total_var_impact = state.get("total_var_impact", 0.0)

    # Get alert level from strategy report
    strategy_report = state.get("strategy_report", {})
    alert_level = strategy_report.get("alert_level", "MEDIUM")

    print(f"[AGENT 5] Building invoice...")
    print(f"[AGENT 5] API costs — Agent 2: €{agent2_api_cost}, Agent 3: €{agent3_api_cost}, Agent 4: €{agent4_api_cost}")
    print(f"[AGENT 5] Cases: {cases_count} | VaR: €{total_var_impact:,.2f} | Alert: {alert_level}")

    output = _build_invoice(
        agent2_api_cost=agent2_api_cost,
        agent3_api_cost=agent3_api_cost,
        agent4_api_cost=agent4_api_cost,
        cases_count=cases_count,
        total_var_impact=total_var_impact,
        alert_level=alert_level,
    )

    elapsed = time.time() - t0
    print(f"[AGENT 5] Done in {elapsed:.3f}s | ROI: {output.roi_multiplier}×")
    if output.action_refused:
        print(f"[AGENT 5] Action REFUSED: {output.refusal_reason}")
    else:
        print(f"[AGENT 5] Invoice: €{output.total_api_cost_eur:.2f} actual vs €{output.total_human_equivalent_eur:,.2f} human equivalent")
        for li in output.line_items:
            print(f"[AGENT 5]   {li.agent}: €{li.api_compute_cost_eur:.4f} → €{li.human_equivalent_value_eur:,.2f} ({li.gross_margin_percent:.1f}% margin)")

    return {"invoice": output.model_dump()}


def cfo_from_data(
    agent2_api_cost: float,
    agent3_api_cost: float,
    agent4_api_cost: float,
    cases_count: int,
    total_var_impact: float,
    alert_level: str,
) -> dict[str, Any]:
    """
    Standalone entry point for Agent 5 — called by the REST API.
    No GraphState needed, takes values directly.
    """
    t0 = time.time()

    print(f"[AGENT 5] Building invoice (standalone)...")

    output = _build_invoice(
        agent2_api_cost=agent2_api_cost,
        agent3_api_cost=agent3_api_cost,
        agent4_api_cost=agent4_api_cost,
        cases_count=cases_count,
        total_var_impact=total_var_impact,
        alert_level=alert_level,
    )

    elapsed = time.time() - t0
    print(f"[AGENT 5] Done in {elapsed:.3f}s | ROI: {output.roi_multiplier}×")

    return {"invoice": output.model_dump()}
