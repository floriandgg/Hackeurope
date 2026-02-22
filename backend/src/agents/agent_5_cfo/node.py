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
)


def _build_invoice(
    agent2_api_cost: float,
    agent3_api_cost: float,
    agent4_api_cost: float,
    cases_count: int,
    total_var_impact: float,
    alert_level: str,
) -> Agent5Output:
    """Build the full invoice from agent costs and outcome data."""

    # --- Action refusal check ---
    if alert_level == "IGNORE":
        return Agent5Output(
            line_items=[],
            total_human_equivalent_eur=0.0,
            total_api_cost_eur=round(agent2_api_cost + agent3_api_cost + agent4_api_cost, 4),
            total_gross_margin_percent=0.0,
            roi_multiplier=0.0,
            invoice_summary="No billable action — crisis assessed as IGNORE level.",
            trade_off_reasoning=(
                "The AI agents determined this situation does not warrant a crisis response. "
                "A traditional PR agency would have charged a minimum retainer fee "
                f"(typically €{CRISIS_STRATEGY_FEE_EUR:,.0f}+) just for the initial assessment. "
                "Our AI completed the analysis at minimal compute cost."
            ),
            action_refused=True,
            refusal_reason=(
                "Alert level is IGNORE — the crisis is too minor to warrant billable "
                "deliverables. Only monitoring costs were incurred."
            ),
        )

    # --- Agent 2: Historical Strategist ---
    hours_saved = cases_count * 3
    agent2_value = hours_saved * CONSULTING_HOUR_RATE_EUR
    agent2_margin = (
        ((agent2_value - agent2_api_cost) / agent2_value) * 100
        if agent2_value > 0
        else 0.0
    )
    line_agent2 = InvoiceLineItem(
        agent="Historical Strategist",
        event="historical_precedents_extracted",
        human_equivalent_value_eur=round(agent2_value, 2),
        api_compute_cost_eur=round(agent2_api_cost, 4),
        gross_margin_percent=round(agent2_margin, 2),
        detail=f"{cases_count} cases × 3h × €{CONSULTING_HOUR_RATE_EUR}/h",
    )

    # --- Agent 3: Risk Analyst ---
    agent3_value = BASE_AUDIT_FEE_EUR + (total_var_impact * AUDIT_RISK_PERCENT)
    agent3_value = round(agent3_value, 2)
    agent3_margin = (
        ((agent3_value - agent3_api_cost) / agent3_value) * 100
        if agent3_value > 0
        else 0.0
    )
    line_agent3 = InvoiceLineItem(
        agent="Risk Analyst",
        event="risk_assessment_completed",
        human_equivalent_value_eur=agent3_value,
        api_compute_cost_eur=round(agent3_api_cost, 4),
        gross_margin_percent=round(agent3_margin, 2),
        detail=f"€{BASE_AUDIT_FEE_EUR} base + 0.01% of €{total_var_impact:,.2f} VaR",
    )

    # --- Agent 4: Executive Strategist ---
    agent4_value = CRISIS_STRATEGY_FEE_EUR
    agent4_margin = (
        ((agent4_value - agent4_api_cost) / agent4_value) * 100
        if agent4_value > 0
        else 0.0
    )
    line_agent4 = InvoiceLineItem(
        agent="Executive Strategist",
        event="crisis_strategy_delivered",
        human_equivalent_value_eur=agent4_value,
        api_compute_cost_eur=round(agent4_api_cost, 4),
        gross_margin_percent=round(agent4_margin, 2),
        detail="Full crisis mitigation plan (fixed fee)",
    )

    # --- Totals ---
    line_items = [line_agent2, line_agent3, line_agent4]
    total_human = sum(li.human_equivalent_value_eur for li in line_items)
    total_api = sum(li.api_compute_cost_eur for li in line_items)
    total_margin = (
        ((total_human - total_api) / total_human) * 100
        if total_human > 0
        else 0.0
    )
    roi_mult = total_human / total_api if total_api > 0 else 0.0

    invoice_summary = (
        f"Crisis response delivered for €{total_api:.2f} in API costs — "
        f"equivalent to €{total_human:,.2f} in traditional consulting fees "
        f"({roi_mult:,.0f}× ROI)."
    )

    trade_off = (
        f"A traditional PR agency would charge €{total_human:,.2f} for this level of crisis response: "
        f"€{agent2_value:,.2f} for precedent research ({hours_saved}h of analyst work), "
        f"€{agent3_value:,.2f} for financial risk assessment, and "
        f"€{agent4_value:,.2f} for strategy development with communication drafts. "
        f"Our AI agents delivered identical outputs in under 60 seconds "
        f"at {total_margin:.1f}% gross margin, saving the client €{total_human - total_api:,.2f}."
    )

    return Agent5Output(
        line_items=line_items,
        total_human_equivalent_eur=round(total_human, 2),
        total_api_cost_eur=round(total_api, 4),
        total_gross_margin_percent=round(total_margin, 2),
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
