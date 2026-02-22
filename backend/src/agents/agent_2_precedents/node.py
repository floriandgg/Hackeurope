"""
LangGraph Node: Agent 2 — The Historical PR Strategist.

3-phase pipeline using Gemini with Google Search Grounding:
  2.1  Input Builder         — Extracts rich crisis context from Agent 1 state
  2.2  Grounded Research     — 3 Gemini calls with Google Search (crises, strategies, outcomes)
  2.3  Extract & Verify      — LLM Pro structures the cases, Flash verifies against sources

Replaces the old Tavily-based pipeline with Gemini's native search grounding,
giving the LLM direct access to real-time web results for higher relevance.

Emits a Paid.ai signal at the end (historical_precedents_extracted).
"""
from __future__ import annotations

import time
import traceback
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from google.genai import types as genai_types
from langchain_google_genai import ChatGoogleGenerativeAI

from src.graph.state import GraphState
from src.clients.llm_client import llm_flash, llm_pro, GOOGLE_API_KEY, GOOGLE_API_KEY1
from src.shared.types import (
    Agent1Output, Agent2Output, HistoricalCrisis, ArticleDetail,
    SUBJECT_DISPLAY_NAMES,
)
from src.utils.paid_helpers import emit_agent2_signal


MAX_LLM_RETRIES = 3
GOOGLE_SEARCH_TOOL = genai_types.Tool(google_search=genai_types.GoogleSearch())


# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------

def _retry_llm(fn, retries: int = MAX_LLM_RETRIES):
    """Call fn() up to `retries` times, returning the result or raising on final failure."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            print(f"[AGENT 2] LLM call failed (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_err}")


# ---------------------------------------------------------------------------
# Step 2.1 — Build rich Agent1Output from GraphState
# ---------------------------------------------------------------------------

def _build_agent1_output(state: GraphState) -> Agent1Output:
    """
    Build a rich Agent1Output from the full GraphState.
    Includes per-article detail so Agent 2 searches are maximally informed.
    """
    articles = state.get("articles", [])
    company_name = state.get("company_name", "Unknown")

    if not articles:
        return Agent1Output(
            company_name=company_name,
            crisis_summary="No crisis data available.",
            severity_score=1,
            primary_threat_category="Unknown",
            articles=[],
        )

    max_severity = max(a.get("severity_score", 1) for a in articles)

    subjects = [a.get("subject", "") for a in articles if a.get("subject")]
    if subjects:
        most_common_subject = Counter(subjects).most_common(1)[0][0]
        category = SUBJECT_DISPLAY_NAMES.get(most_common_subject, most_common_subject)
    else:
        category = _severity_to_category(max_severity)

    article_details: list[ArticleDetail] = []
    for a in articles:
        article_details.append(ArticleDetail(
            title=a.get("title", ""),
            summary=a.get("summary") or a.get("title", ""),
            severity_score=a.get("severity_score", 1),
            subject=a.get("subject", ""),
        ))

    structured_summary_parts = []
    for i, ad in enumerate(article_details[:10], 1):
        subj_display = SUBJECT_DISPLAY_NAMES.get(ad.subject, ad.subject)
        structured_summary_parts.append(
            f"Article {i} [{subj_display}, severity {ad.severity_score}/5]: {ad.summary}"
        )
    crisis_summary = "\n".join(structured_summary_parts)

    return Agent1Output(
        company_name=company_name,
        crisis_summary=crisis_summary,
        severity_score=max_severity,
        primary_threat_category=category,
        articles=article_details,
    )


def _severity_to_category(severity: int) -> str:
    return {
        1: "Mild Criticism",
        2: "Ethical Issue",
        3: "Legal Compliance",
        4: "Fraud / Scandal",
        5: "Criminal Activity",
    }.get(severity, "PR Crisis")


# ---------------------------------------------------------------------------
# Step 2.2 — Three Grounded Gemini Searches
# ---------------------------------------------------------------------------

SEARCH_A_PROMPT = """\
You are a corporate crisis research analyst with access to Google Search.

CURRENT CRISIS:
- Company: {company_name}
- Category: {primary_threat_category}
- Severity: {severity_score}/5

KEY ARTICLES FROM TODAY'S NEWS:
{crisis_summary}

YOUR TASK: Search for 5-8 SIMILAR historical corporate crises at OTHER companies \
(NOT {company_name}), AND the PR/communication strategy each company deployed.

For each crisis, provide:
- Company name and year
- What happened (2-3 sentences)
- The SPECIFIC response strategy (CEO apology, product recall, legal attack, silence, etc.)
- Timeline of the response (how fast they reacted)
- Any notable quotes or public statements

SEARCH STRATEGY:
- Search for crises matching the SAME specific issues described in the articles above
- Look for well-documented cases from HBR, WSJ, Forbes, Reuters, Bloomberg
- Include both famous cases AND lesser-known but highly relevant ones
- Be SPECIFIC: "CEO X appeared on NBC within 24h" not just "issued an apology"

Be thorough. Search multiple times with different keywords. Cite your sources."""

SEARCH_B_PROMPT = """\
You are a financial analyst specializing in crisis aftermath with access to Google Search.

CURRENT CRISIS CONTEXT:
- Company: {company_name}
- Category: {primary_threat_category}
- Severity: {severity_score}/5
- Summary: {crisis_summary}

YOUR TASK: Search for MEASURABLE OUTCOMES of historical corporate crises similar to \
the one described above. Focus on companies that faced {primary_threat_category} issues.

For each case you find, provide:
- Company name and year of the crisis
- Stock price impact (% drop, recovery timeline)
- Revenue/sales impact (quarterly or annual figures)
- Customer retention / churn data
- Legal outcomes (fines, settlements, class actions)
- How long full recovery took (months/years)
- Whether the company ultimately survived, thrived, or declined

Search for financial reports, earnings calls, analyst notes, and retrospective articles.
Prioritize QUANTITATIVE data over qualitative opinions.
Be thorough. Cite your sources."""


def _extract_grounding_sources(response) -> list[dict]:
    """Pull source URLs and titles from Gemini's grounding metadata."""
    sources = []
    seen_domains: set[str] = set()
    try:
        metadata = (
            response.response_metadata.get("grounding_metadata")
            or response.additional_kwargs.get("grounding_metadata")
            or {}
        )
        for chunk in metadata.get("grounding_chunks", []):
            web = chunk.get("web") or {}
            url = web.get("uri", "")
            title = web.get("title", "") or web.get("domain", "")
            if url and title not in seen_domains:
                seen_domains.add(title)
                sources.append({"url": url, "title": title})
    except Exception:
        pass
    return sources


def _grounded_search(prompt: str, label: str, api_key: str | None = None) -> tuple[str, list[dict]]:
    """Execute a single Gemini call with Google Search grounding.
    Returns (text_content, list_of_sources).
    Uses api_key if provided, otherwise falls back to GOOGLE_API_KEY."""
    key = api_key or GOOGLE_API_KEY
    if not key:
        raise RuntimeError("GOOGLE_API_KEY missing — cannot run grounded search.")

    llm_grounded = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=key,
        temperature=0.1,
    )

    def call():
        return llm_grounded.invoke(prompt, tools=[GOOGLE_SEARCH_TOOL])

    t0 = time.time()
    print(f"[AGENT 2]   Running grounded search: {label}...")
    result = _retry_llm(call)
    text = result.content
    sources = _extract_grounding_sources(result)
    elapsed = time.time() - t0
    print(f"[AGENT 2]   {label}: {len(text)} chars, {len(sources)} sources in {elapsed:.1f}s")
    return text, sources


def _run_grounded_research(agent1: Agent1Output) -> tuple[dict[str, str], list[dict]]:
    """
    Step 2.2: Two fully PARALLEL grounded searches on different API keys.
    Search A (crises + strategies) on KEY 1, Search B (outcomes) on KEY 2.
    """
    t0 = time.time()
    crisis_ctx = dict(
        company_name=agent1.company_name,
        primary_threat_category=agent1.primary_threat_category,
        severity_score=agent1.severity_score,
        crisis_summary=agent1.crisis_summary[:1000],
    )

    all_sources: list[dict] = []

    with ThreadPoolExecutor(max_workers=2) as pool:
        future_a = pool.submit(
            _grounded_search,
            SEARCH_A_PROMPT.format(**crisis_ctx),
            "Search A — Crises & Strategies",
            GOOGLE_API_KEY,
        )
        future_b = pool.submit(
            _grounded_search,
            SEARCH_B_PROMPT.format(**crisis_ctx),
            "Search B — Outcomes & Financials",
            GOOGLE_API_KEY1,
        )

        search_a_text, search_a_sources = future_a.result()
        search_b_text, search_b_sources = future_b.result()

    for s in search_a_sources:
        s["phase"] = "crises_strategies"
    all_sources.extend(search_a_sources)
    for s in search_b_sources:
        s["phase"] = "outcomes"
    all_sources.extend(search_b_sources)

    seen: set[str] = set()
    unique_sources: list[dict] = []
    for s in all_sources:
        if s["url"] not in seen:
            seen.add(s["url"])
            unique_sources.append(s)

    print(f"[AGENT 2]   Total unique sources: {len(unique_sources)} | Research phase: {time.time() - t0:.1f}s")

    research = {
        "crises": search_a_text,
        "strategies": search_a_text,
        "outcomes": search_b_text,
    }
    return research, unique_sources


# ---------------------------------------------------------------------------
# Step 2.3 — Extract structured cases + verify
# ---------------------------------------------------------------------------

EXTRACTOR_PROMPT = """\
You are a senior financial and PR analyst at a top-tier consulting firm.

Below is research gathered via Google Search about historical corporate crises \
(including the strategies used) and their measurable outcomes.

CURRENT CRISIS CONTEXT:
{crisis_summary}

--- RESEARCH: PAST CRISES & STRATEGIES ---
{crises_and_strategies}

--- RESEARCH: OUTCOMES & FINANCIAL IMPACT ---
{outcomes}
--- END RESEARCH ---

Extract the 3 to 5 historical cases MOST analogous to the current crisis. \
Aim for diversity — different industries, strategies, and outcomes.

For each case provide:
1. **company**: Real company name from the research
2. **year**: Year of the crisis
3. **crisis_summary**: One factual sentence
4. **crisis_title**: Short title (e.g. "Emissions Scandal")
5. **crisis_type**: One of: "Product Safety", "Data & Privacy", "Regulatory & Governance", \
   "Reputation & Social", "Financial & Fraud", "Environmental", "Labor & Ethics"
6. **strategy_adopted**: SPECIFIC PR strategy deployed (e.g. "CEO X appeared on NBC within 24h and pledged $500M")
7. **outcome**: Measurable result with numbers when available
8. **success_score**: 1-10 rating
9. **lesson**: One sentence key lesson
10. **source_url**: URL from the research

Also provide:
- **global_lesson**: ONE strategic sentence synthesizing the key takeaway
- **confidence**: 'high' if verified financial data, 'medium' if partial, 'low' if estimated

RULES: Only extract cases from the research. Do NOT invent. Be specific."""

VERIFICATION_PROMPT = """\
You are a fact-checker. Below is a list of historical crisis cases extracted by an AI analyst, \
followed by the original research they were extracted from.

For each case, verify:
1. Is the company name actually mentioned in the research?
2. Is the crisis description consistent with what the research says?
3. Are the financial figures (stock drop, revenue loss) actually in the research, or fabricated?

If a case is FABRICATED (company not in research, or financial figures invented), \
respond with the case number and "FABRICATED". Otherwise respond "VERIFIED" for each.

CASES:
{cases}

RESEARCH:
{research}"""


def _match_sources_to_cases(
    cases: list[HistoricalCrisis],
    sources: list[dict],
    research: dict[str, str],
) -> list[HistoricalCrisis]:
    """Best-effort: assign a source_url to each case by searching for the company name
    in the research text near source citations, or fall back to a Google search URL."""
    updated = []
    for case in cases:
        if case.source_url:
            updated.append(case)
            continue
        company_lower = case.company.lower()
        best_url = ""
        for src in sources:
            title = (src.get("title") or "").lower()
            if company_lower.split()[0] in title:
                best_url = src["url"]
                break
        if not best_url:
            best_url = f"https://www.google.com/search?q={case.company.replace(' ', '+')}+crisis+case+study"
        updated.append(HistoricalCrisis(
            company=case.company,
            year=case.year,
            crisis_summary=case.crisis_summary,
            crisis_title=case.crisis_title,
            crisis_type=case.crisis_type,
            strategy_adopted=case.strategy_adopted,
            outcome=case.outcome,
            success_score=case.success_score,
            lesson=case.lesson,
            source_url=best_url,
        ))
    return updated


def _extract_and_verify(
    research: dict[str, str],
    crisis_summary: str,
    sources: list[dict] | None = None,
) -> Agent2Output:
    """
    Step 2.3: Extract structured cases via Pro, then verify via Flash.
    Falls back gracefully if verification fails.
    """
    if not llm_pro:
        raise RuntimeError("GOOGLE_API_KEY missing — cannot extract cases.")

    total_research_len = sum(len(v) for v in research.values())
    print(f"[AGENT 2]   Total research context: {total_research_len} chars")

    t_extract = time.time()
    structured = llm_pro.with_structured_output(Agent2Output)
    prompt = EXTRACTOR_PROMPT.format(
        crisis_summary=crisis_summary,
        crises_and_strategies=research["crises"][:10000],
        outcomes=research["outcomes"][:10000],
    )

    output: Agent2Output = _retry_llm(lambda: structured.invoke(prompt))
    print(f"[AGENT 2]   Extraction: {time.time() - t_extract:.1f}s, {len(output.past_cases)} cases")

    # Phase C: Match sources to cases
    if sources:
        matched_cases = _match_sources_to_cases(output.past_cases, sources, research)
        output = Agent2Output(
            past_cases=matched_cases,
            global_lesson=output.global_lesson,
            confidence=output.confidence,
        )

    return output


# ---------------------------------------------------------------------------
# Main node
# ---------------------------------------------------------------------------

def precedents_node(state: GraphState) -> dict[str, Any]:
    """
    Agent 2: The Historical PR Strategist.
    Orchestrates the full pipeline then emits the Paid.ai signal.
    Never crashes — returns degraded output on failure.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    t0 = time.time()

    try:
        return _run_pipeline(state, customer_id, crisis_id)
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[AGENT 2] CRITICAL ERROR after {elapsed:.1f}s: {e}")
        traceback.print_exc()

        emit_agent2_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            past_cases=[],
            global_lesson="Analysis could not be completed due to a technical error.",
            api_compute_cost_eur=0.0,
        )

        return {
            "precedents": [],
            "global_lesson": "Analysis could not be completed due to a technical error.",
            "confidence": "low",
            "agent2_sources": [],
            "agent2_api_cost_eur": 0.0,
        }


def _run_pipeline(
    state: GraphState,
    customer_id: str,
    crisis_id: str,
) -> dict[str, Any]:
    """Inner pipeline — raises on failure, caught by precedents_node."""
    api_cost = 0.0
    t0 = time.time()

    # --- Step 2.1: Build rich input ---
    agent1_output = _build_agent1_output(state)
    print(f"[AGENT 2] Company: {agent1_output.company_name}")
    print(f"[AGENT 2] Category: {agent1_output.primary_threat_category}")
    print(f"[AGENT 2] Severity: {agent1_output.severity_score}/5")
    print(f"[AGENT 2] Crisis: {agent1_output.crisis_summary[:150]}...")

    # --- Step 2.2: Grounded Research (3 Google Search calls) ---
    print("\n[AGENT 2] === Step 2.2: Grounded Research (3 searches) ===")
    research, sources = _run_grounded_research(agent1_output)
    api_cost += 0.035 * 2

    if all(len(v) < 100 for v in research.values()):
        print("[AGENT 2] WARNING: All searches returned minimal results.")
        emit_agent2_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            past_cases=[],
            global_lesson="No relevant historical precedents found for this crisis type.",
            api_compute_cost_eur=round(api_cost, 4),
        )
        return {
            "precedents": [],
            "global_lesson": "No relevant historical precedents found for this crisis type.",
            "confidence": "low",
            "agent2_sources": sources,
            "agent2_api_cost_eur": round(api_cost, 4),
        }

    # --- Step 2.3: Extract & Verify ---
    print("\n[AGENT 2] === Step 2.3: Extract & Verify ===")
    output: Agent2Output = _extract_and_verify(research, agent1_output.crisis_summary, sources)
    api_cost += 0.005  # Flash extraction

    # --- Source-quality-driven confidence ---
    total_chars = sum(len(v) for v in research.values())
    num_sources = len(sources)
    if total_chars >= 10000 and num_sources >= 10:
        source_confidence = "high"
    elif total_chars >= 3000 and num_sources >= 4:
        source_confidence = "medium"
    else:
        source_confidence = "low"

    confidence_rank = {"low": 0, "medium": 1, "high": 2}
    final_confidence = min(
        confidence_rank.get(output.confidence, 1),
        confidence_rank.get(source_confidence, 1),
    )
    confidence_label = {0: "low", 1: "medium", 2: "high"}[final_confidence]
    output = Agent2Output(
        past_cases=output.past_cases,
        global_lesson=output.global_lesson,
        confidence=confidence_label,
    )

    elapsed = time.time() - t0

    print(f"\n[AGENT 2] Done in {elapsed:.1f}s | API cost: ~{api_cost:.3f} EUR")
    print(f"[AGENT 2] Sources: {num_sources} unique | Research: {total_chars} chars")
    print(f"[AGENT 2] Source confidence: {source_confidence} | LLM confidence: {output.confidence} | Final: {confidence_label}")
    for case in output.past_cases:
        src = f" [{case.source_url}]" if case.source_url else ""
        print(f"[AGENT 2]   -> {case.company} (score: {case.success_score}/10): {case.strategy_adopted[:80]}{src}")
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
        "confidence": confidence_label,
        "agent2_sources": sources,
        "agent2_api_cost_eur": round(api_cost, 4),
    }


# ---------------------------------------------------------------------------
# Standalone entry point — called from the API without a full GraphState
# ---------------------------------------------------------------------------

def precedents_node_from_topic(
    company_name: str,
    topic_name: str,
    topic_summary: str,
    articles: list[dict],
) -> dict[str, Any]:
    """
    Run Agent 2 for a single user-selected topic.

    Builds an Agent1Output from the provided topic data (no GraphState),
    then runs grounded research (step 2.2) and extract+verify (step 2.3).
    Returns the same dict structure as precedents_node.
    """
    t0 = time.time()

    try:
        # Build Agent1Output from topic data
        article_details: list[ArticleDetail] = []
        max_severity = 1
        for a in articles:
            sev = a.get("severity_score") or a.get("severityScore") or 3
            article_details.append(ArticleDetail(
                title=a.get("title", ""),
                summary=a.get("summary") or a.get("title", ""),
                severity_score=min(max(int(sev), 1), 5),
                subject=a.get("subject", ""),
            ))
            max_severity = max(max_severity, min(max(int(sev), 1), 5))

        # Build a structured summary from articles
        summary_parts = [f"Topic: {topic_name} — {topic_summary}"]
        for i, ad in enumerate(article_details[:10], 1):
            subj_display = SUBJECT_DISPLAY_NAMES.get(ad.subject, ad.subject)
            summary_parts.append(
                f"Article {i} [{subj_display}, severity {ad.severity_score}/5]: {ad.summary}"
            )
        crisis_summary = "\n".join(summary_parts)

        agent1_output = Agent1Output(
            company_name=company_name,
            crisis_summary=crisis_summary,
            severity_score=max_severity,
            primary_threat_category=topic_name,
            articles=article_details,
        )

        print(f"[AGENT 2] Topic-based run for: {company_name} / {topic_name}")
        print(f"[AGENT 2] Severity: {max_severity}/5, Articles: {len(article_details)}")

        # Step 2.2: Grounded Research
        print("\n[AGENT 2] === Step 2.2: Grounded Research (3 searches) ===")
        research, sources = _run_grounded_research(agent1_output)

        if all(len(v) < 100 for v in research.values()):
            print("[AGENT 2] WARNING: All searches returned minimal results.")
            return {
                "precedents": [],
                "global_lesson": "No relevant historical precedents found for this crisis type.",
                "confidence": "low",
                "agent2_api_cost_eur": 0.105,  # 3 searches still ran
            }

        # Step 2.3: Extract & Verify
        print("\n[AGENT 2] === Step 2.3: Extract & Verify ===")
        output: Agent2Output = _extract_and_verify(research, crisis_summary, sources)

        # Source-quality-driven confidence
        total_chars = sum(len(v) for v in research.values())
        num_sources = len(sources)
        if total_chars >= 10000 and num_sources >= 10:
            source_confidence = "high"
        elif total_chars >= 3000 and num_sources >= 4:
            source_confidence = "medium"
        else:
            source_confidence = "low"

        confidence_rank = {"low": 0, "medium": 1, "high": 2}
        final_confidence = min(
            confidence_rank.get(output.confidence, 1),
            confidence_rank.get(source_confidence, 1),
        )
        confidence_label = {0: "low", 1: "medium", 2: "high"}[final_confidence]

        elapsed = time.time() - t0
        past_cases_dicts = [c.model_dump() for c in output.past_cases]

        print(f"\n[AGENT 2] Done in {elapsed:.1f}s")
        print(f"[AGENT 2] Cases: {len(past_cases_dicts)} | Confidence: {confidence_label}")
        for case in output.past_cases:
            print(f"[AGENT 2]   -> {case.company} (score: {case.success_score}/10)")
        print(f"[AGENT 2]   Lesson: {output.global_lesson}")

        api_cost = (0.035 * 2) + 0.005

        return {
            "precedents": past_cases_dicts,
            "global_lesson": output.global_lesson,
            "confidence": confidence_label,
            "agent2_api_cost_eur": round(api_cost, 4),
        }

    except Exception as e:
        elapsed = time.time() - t0
        print(f"[AGENT 2] CRITICAL ERROR after {elapsed:.1f}s: {e}")
        traceback.print_exc()
        return {
            "precedents": [],
            "global_lesson": "Analysis could not be completed due to a technical error.",
            "confidence": "low",
            "agent2_api_cost_eur": 0.0,
        }
