"""
LangGraph Node: Agent 4 — The Strategist.

Receives enriched articles (Reach, Churn, VaR) from Agent 3 and
historical precedents from Agent 2. Passes everything to the LLM
which reasons about alert level, generates 3 strategies, recommends
the best one, and drafts all communications.

Emits Paid.ai signal ONLY if strategies generated successfully.
"""
from __future__ import annotations

import time
import traceback
from typing import Any

from src.graph.state import GraphState
from src.clients.llm_client import llm_pro, llm_flash
from src.shared.types import Agent4Output
from src.utils.paid_helpers import emit_agent4_signal


MAX_LLM_RETRIES = 3

STRATEGIST_PROMPT = """\
You are an elite crisis communications strategist at a Fortune 500 PR firm.
You have been given real-time data about a corporate crisis. Your job is to
analyze the situation and produce a complete crisis response plan.

═══════════════════════════════════════════════
COMPANY: {company_name}
═══════════════════════════════════════════════

── RISK METRICS (from our Risk Analyst) ──

Total Value at Risk (VaR): €{total_var:,.2f}
Max Severity Score: {severity_score}/5

Per-article breakdown:
{articles_block}

── HISTORICAL PRECEDENTS (from our Research team) ──

{precedents_block}

Global lesson: {global_lesson}
Research confidence: {confidence}

═══════════════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════════════

1. **ALERT LEVEL**: Based on ALL the metrics above (VaR, Reach, Churn, Severity),
   classify this crisis as IGNORE / SOFT / MEDIUM / CRITICAL.
   - Do NOT use fixed EUR thresholds. Instead, reason about the PROPORTIONAL risk:
     how significant is this VaR relative to a typical company's revenue?
     How widespread is the reach? How dangerous is the churn risk?
   - Explain your reasoning.

2. **RECOMMENDED ACTION**: Should the company 'communicate' (public response),
   'monitor_only' (watch but don't react publicly), or 'legal_action' (legal response)?

3. **THREE STRATEGIES**: Generate exactly 3 strategies:
   - **Offensive**: Legal-focused, firm tone, higher cost, slower ROI.
     Involves cease-and-desist, legal notices, aggressive fact-correction.
   - **Diplomate**: Empathy + transparency + facts. Balanced cost.
     Includes public acknowledgment, proactive communication, commercial gesture if churn is high.
   - **Silence**: Minimize the Streisand effect. Minimal cost.
     Private responses only, no public statement, wait for news cycle to pass.

   For each strategy, provide:
   - Concrete key actions (3-5 specific steps)
   - Communication channels to use
   - Estimated cost in EUR (be realistic: legal = expensive, silence = cheap)
   - Expected impact on the crisis
   - ROI score (1-10)

4. **RECOMMENDATION**: Pick the strategy that maximizes ROI given the data.
   If Churn Risk is high (>2-3%), lean toward Diplomate.
   If the crisis is factually wrong, lean toward Offensive.
   If Reach is low and severity is mild, lean toward Silence.
   Explain your reasoning.

5. **COMMUNICATION DRAFTS** (written from the company's perspective):
   - **Press Release**: Formal, professional, 150-300 words. Adapted to the recommended strategy's tone.
   - **Internal Email**: Reassure employees, 100-200 words. Transparent but confident.
   - **Social Media Post**: Concise, <280 characters. Platform-appropriate.
   - **Legal Notice** (only if alert_level is CRITICAL): Formal legal notice / mise en demeure draft. Leave empty string if not CRITICAL.

6. **DECISION SUMMARY**: A 3-5 line human-readable explanation of your reasoning chain
   (what data drove what decision), suitable for showing to an executive.

CRITICAL RULES:
- Use the ACTUAL numbers from the data above — do not invent metrics.
- Reference the historical precedents to justify your strategy choice.
- The press release and email must mention the company by name ({company_name}).
- Adapt tone based on the actual churn risk and severity data.
- All costs must be in EUR.
"""


def _retry_llm(fn, retries: int = MAX_LLM_RETRIES):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            print(f"[AGENT 4] LLM call failed (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_err}")


def _build_articles_block(articles: list[dict]) -> str:
    if not articles:
        return "(No article data available)"
    lines = []
    for i, a in enumerate(articles, 1):
        lines.append(
            f"  {i}. \"{a.get('title', 'N/A')}\"\n"
            f"     Subject: {a.get('subject', 'N/A')} | "
            f"Authority: {a.get('authority_score', '?')}/5 | "
            f"Severity: {a.get('severity_score', '?')}/5\n"
            f"     Reach: {a.get('reach_estimate', 0):,.0f} people | "
            f"Churn Risk: {a.get('churn_risk_percent', 0):.1f}% | "
            f"VaR: €{a.get('value_at_risk', 0):,.2f}\n"
            f"     Summary: {a.get('summary', '')[:200]}"
        )
    return "\n".join(lines)


def _build_precedents_block(precedents: list[dict]) -> str:
    if not precedents:
        return "(No historical precedents available — base strategy on crisis data alone)"
    lines = []
    for i, p in enumerate(precedents, 1):
        lines.append(
            f"  {i}. {p.get('company', 'N/A')}: {p.get('crisis_summary', 'N/A')}\n"
            f"     Strategy: {p.get('strategy_adopted', 'N/A')}\n"
            f"     Outcome: {p.get('outcome', 'N/A')}\n"
            f"     Effectiveness: {p.get('success_score', '?')}/10"
        )
    return "\n".join(lines)


def strategist_node(state: GraphState) -> dict[str, Any]:
    """
    Agent 4: reads risk metrics + precedents, calls LLM to generate
    alert level, 3 strategies, recommendation, and all communication drafts.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    t0 = time.time()

    try:
        return _run_strategist(state, customer_id, crisis_id, t0)
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[AGENT 4] CRITICAL ERROR after {elapsed:.1f}s: {e}")
        traceback.print_exc()

        return {
            "strategy_report": {},
            "recommended_strategy_name": "",
            "drafts_generated": 0,
            "agent4_api_cost_eur": 0.0,
        }


def _run_strategist(
    state: GraphState,
    customer_id: str,
    crisis_id: str,
    t0: float,
) -> dict[str, Any]:
    company_name = state.get("company_name", "Unknown")
    articles = state.get("articles", [])
    precedents = state.get("precedents", [])
    global_lesson = state.get("global_lesson", "No lesson available.")
    confidence = state.get("confidence", "low")
    total_var = state.get("total_var_impact", 0.0)
    severity_score = state.get("severity_score", 0)

    print(f"[AGENT 4] Company: {company_name}")
    print(f"[AGENT 4] Articles: {len(articles)} | Precedents: {len(precedents)}")
    print(f"[AGENT 4] Total VaR: €{total_var:,.2f} | Max Severity: {severity_score}/5")

    articles_block = _build_articles_block(articles)
    precedents_block = _build_precedents_block(precedents)

    prompt = STRATEGIST_PROMPT.format(
        company_name=company_name,
        total_var=total_var,
        severity_score=severity_score,
        articles_block=articles_block,
        precedents_block=precedents_block,
        global_lesson=global_lesson,
        confidence=confidence,
    )

    use_llm = llm_pro or llm_flash
    if not use_llm:
        raise RuntimeError("No LLM configured (GOOGLE_API_KEY missing).")

    model_name = "Pro" if llm_pro else "Flash"
    print(f"[AGENT 4] Calling Gemini {model_name} with structured output...")

    structured = use_llm.with_structured_output(Agent4Output)
    output: Agent4Output = _retry_llm(lambda: structured.invoke(prompt))

    api_cost = 0.02 if llm_pro else 0.005

    elapsed = time.time() - t0
    print(f"[AGENT 4] Done in {elapsed:.1f}s | Alert: {output.alert_level}")
    print(f"[AGENT 4] Recommended: {output.recommended_strategy} — {output.recommendation_reasoning[:100]}")
    for s in output.strategies:
        print(f"[AGENT 4]   Strategy '{s.name}': ROI {s.roi_score}/10, Cost €{s.estimated_cost_eur:,.0f}")

    strategy_report = output.model_dump()

    drafts = [
        d for d in [
            output.press_release,
            output.internal_email,
            output.social_post,
            output.legal_notice_draft,
        ]
        if d and d.strip()
    ]
    drafts_count = len(drafts)
    recommended_name = output.recommended_strategy

    success = bool(recommended_name and drafts_count >= 2)

    if success and customer_id and crisis_id:
        emit_agent4_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            recommended_strategy_name=recommended_name,
            drafts_generated=drafts_count,
            api_compute_cost_eur=api_cost,
        )

    return {
        "strategy_report": strategy_report,
        "recommended_strategy_name": recommended_name,
        "drafts_generated": drafts_count,
        "agent4_api_cost_eur": round(api_cost, 4),
    }


def strategist_from_data(
    company_name: str,
    articles: list[dict],
    precedents: list[dict],
    global_lesson: str,
    confidence: str,
    total_var_impact: float,
    severity_score: int,
) -> dict[str, Any]:
    """
    Standalone entry point for Agent 4 — called by the REST API.
    Builds a minimal GraphState and delegates to _run_strategist().
    """
    state: GraphState = {
        "company_name": company_name,
        "articles": articles,
        "precedents": precedents,
        "global_lesson": global_lesson,
        "confidence": confidence,
        "total_var_impact": total_var_impact,
        "severity_score": severity_score,
        "customer_id": "",
        "crisis_id": "",
    }
    t0 = time.time()
    try:
        return _run_strategist(state, "", "", t0)
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[AGENT 4] CRITICAL ERROR after {elapsed:.1f}s: {e}")
        traceback.print_exc()
        return {
            "strategy_report": {},
            "recommended_strategy_name": "",
            "drafts_generated": 0,
            "agent4_api_cost_eur": 0.0,
        }
