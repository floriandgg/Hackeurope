"""
LangGraph Node: Agent 2 — The Historical PR Strategist.

3-step pipeline:
  2.1  Query Engineer   — LLM Flash generates 3 OSINT search queries
  2.2  Tavily Engine    — Advanced search on premium sources
  2.3  Compressor       — LLM Pro extracts structured past_cases (Pydantic)

Emits a Paid.ai signal at the end (historical_precedents_extracted).
"""
from __future__ import annotations

import time
from typing import Any

from src.graph.state import GraphState
from src.clients.llm_client import llm_flash, llm_pro
from src.clients.tavily_client import tavily_client
from src.shared.types import Agent1Output, Agent2Output, SearchQueries
from src.utils.paid_helpers import emit_agent2_signal


# ---------------------------------------------------------------------------
# Step 2.1 — Query Engineer (Gemini Flash)
# ---------------------------------------------------------------------------

QUERY_ENGINEER_PROMPT = """\
You are a B2B OSINT expert. The user is facing a PR crisis of type: {primary_threat_category}.
Summary: {crisis_summary}.

Generate exactly 3 Google search queries (in English) to find case studies \
(post-mortems) about similar historical crises that affected OTHER companies.

Your queries MUST include mandatory keywords such as: \
'PR case study', 'crisis management retrospective', 'financial impact', 'stock drop after scandal'.

Do NOT search for the current crisis. Search for historical precedents only."""


def _generate_search_queries(agent1: Agent1Output) -> list[str]:
    """Step 2.1: generate 3 search queries via Gemini Flash."""
    if not llm_flash:
        raise RuntimeError("GOOGLE_API_KEY missing — cannot generate queries.")

    structured = llm_flash.with_structured_output(SearchQueries)
    prompt = QUERY_ENGINEER_PROMPT.format(
        primary_threat_category=agent1.primary_threat_category,
        crisis_summary=agent1.crisis_summary,
    )
    result: SearchQueries = structured.invoke(prompt)
    return result.queries


# ---------------------------------------------------------------------------
# Step 2.2 — Tavily Engine (advanced search)
# ---------------------------------------------------------------------------

PREMIUM_DOMAINS = [
    "hbr.org", "wsj.com", "forbes.com", "ft.com",
    "bloomberg.com", "prweek.com", "reuters.com",
]


def _fetch_historical_cases(queries: list[str]) -> str:
    """Step 2.2: run Tavily queries and aggregate raw context."""
    if not tavily_client:
        raise RuntimeError("TAVILY_API_KEY missing — cannot search.")

    aggregated_context = ""

    for q in queries:
        print(f"[AGENT 2] Tavily search: {q}")
        response = tavily_client.search(
            query=q,
            search_depth="advanced",
            include_answer=True,
            include_raw_content=True,
            max_results=2,
            include_domains=PREMIUM_DOMAINS,
        )

        results = response.get("results", [])

        if not results:
            print(f"[AGENT 2] No premium results, falling back without domain filter...")
            response = tavily_client.search(
                query=q,
                search_depth="advanced",
                include_answer=True,
                include_raw_content=True,
                max_results=2,
            )
            results = response.get("results", [])

        answer = response.get("answer", "")
        if answer:
            aggregated_context += f"\n--- Tavily Answer ---\n{answer}\n"

        for r in results:
            raw = r.get("raw_content") or r.get("content", "")
            title = r.get("title", "")
            url = r.get("url", "")
            chunk = raw[:3000] if raw else ""
            aggregated_context += f"\n--- Source: {title} ({url}) ---\n{chunk}\n"

    return aggregated_context


# ---------------------------------------------------------------------------
# Step 2.3 — Compressor / Extractor (Gemini Pro + Structured Output)
# ---------------------------------------------------------------------------

EXTRACTOR_PROMPT = """\
You are a financial and PR analyst. Below are documents from web research on historical crises.

Your mission is to extract the 2 or 3 most relevant cases that resemble our current crisis: {crisis_summary}.

Be factual. For each case, identify:
- The company involved
- The exact communication strategy deployed (e.g.: Denial, Immediate apology, Product recall)
- The final financial/reputational impact
- A score out of 10 rating the effectiveness of that strategy

If there is no explicit financial data, estimate the reputational impact.

--- DOCUMENTS ---
{aggregated_context}
--- END DOCUMENTS ---"""


def _extract_structured_cases(aggregated_context: str, crisis_summary: str) -> Agent2Output:
    """Step 2.3: structured extraction via Gemini Pro."""
    if not llm_pro:
        raise RuntimeError("GOOGLE_API_KEY missing — cannot extract cases.")

    structured = llm_pro.with_structured_output(Agent2Output)
    prompt = EXTRACTOR_PROMPT.format(
        crisis_summary=crisis_summary,
        aggregated_context=aggregated_context[:15000],
    )
    return structured.invoke(prompt)


# ---------------------------------------------------------------------------
# Helpers: build Agent1Output from GraphState
# ---------------------------------------------------------------------------

CATEGORY_MAP = {
    1: "Mild Criticism",
    2: "Ethical Issue",
    3: "Legal Compliance",
    4: "Fraud / Scandal",
    5: "Criminal Activity",
}


def _build_agent1_output(state: GraphState) -> Agent1Output:
    """Build Agent1Output from the GraphState (Agent 1 articles)."""
    articles = state.get("articles", [])
    company_name = state.get("company_name", "Unknown")

    if not articles:
        return Agent1Output(
            company_name=company_name,
            crisis_summary="No crisis data available.",
            severity_score=1,
            primary_threat_category="Unknown",
        )

    top = articles[0]  # already sorted by exposure_score descending
    severity = top.get("severity_score", 2)

    summaries = [a.get("summary", a.get("title", "")) for a in articles[:3]]
    crisis_summary = " | ".join(summaries)

    return Agent1Output(
        company_name=company_name,
        crisis_summary=crisis_summary[:500],
        severity_score=severity,
        primary_threat_category=CATEGORY_MAP.get(severity, "PR Crisis"),
    )


# ---------------------------------------------------------------------------
# Main node
# ---------------------------------------------------------------------------

def precedents_node(state: GraphState) -> dict[str, Any]:
    """
    Agent 2: The Historical PR Strategist.
    Orchestrates the 3 steps then emits the Paid.ai signal.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    api_cost = 0.0
    t0 = time.time()

    agent1_output = _build_agent1_output(state)
    print(f"[AGENT 2] Crisis: {agent1_output.crisis_summary[:100]}...")
    print(f"[AGENT 2] Category: {agent1_output.primary_threat_category}")

    # --- Step 2.1: Query Engineer ---
    print("\n[AGENT 2] === Step 2.1: Query Engineer ===")
    queries = _generate_search_queries(agent1_output)
    for i, q in enumerate(queries, 1):
        print(f"[AGENT 2]   Query {i}: {q}")
    api_cost += 0.001

    # --- Step 2.2: Tavily Engine ---
    print("\n[AGENT 2] === Step 2.2: Tavily Search ===")
    aggregated_context = _fetch_historical_cases(queries)
    context_len = len(aggregated_context)
    print(f"[AGENT 2]   Aggregated context: {context_len} chars")
    api_cost += 0.02 * len(queries)

    # --- Step 2.3: Compressor / Extractor ---
    print("\n[AGENT 2] === Step 2.3: Structured Extraction ===")
    output: Agent2Output = _extract_structured_cases(
        aggregated_context, agent1_output.crisis_summary
    )
    api_cost += 0.01

    elapsed = time.time() - t0

    print(f"\n[AGENT 2] Done in {elapsed:.1f}s | Estimated API cost: {api_cost:.3f} EUR")
    for case in output.past_cases:
        print(f"[AGENT 2]   -> {case.company} (score: {case.success_score}/10): {case.strategy_adopted}")
    print(f"[AGENT 2]   Lesson: {output.global_lesson}")

    past_cases_dicts = [c.model_dump() for c in output.past_cases]

    emit_agent2_signal(
        customer_external_id=customer_id,
        crisis_id=crisis_id,
        past_cases=past_cases_dicts,
        global_lesson=output.global_lesson,
        api_compute_cost_eur=round(api_cost, 4),
    )

    return {
        "precedents": past_cases_dicts,
        "global_lesson": output.global_lesson,
        "agent2_api_cost_eur": round(api_cost, 4),
    }
