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
from typing import Any

from google.genai import types as genai_types
from langchain_google_genai import ChatGoogleGenerativeAI

from src.graph.state import GraphState
from src.clients.llm_client import llm_flash, llm_pro, GOOGLE_API_KEY
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

SEARCH_1_PROMPT = """\
You are a corporate crisis research analyst with access to Google Search.

CURRENT CRISIS:
- Company: {company_name}
- Category: {primary_threat_category}
- Severity: {severity_score}/5

KEY ARTICLES FROM TODAY'S NEWS:
{crisis_summary}

YOUR TASK: Search for and identify 5-8 SIMILAR historical corporate crises that \
happened at OTHER companies (NOT {company_name}).

For each crisis you find, provide:
- Company name
- Year
- What happened (2-3 sentences)
- How severe it was (financial losses, reputational damage)

SEARCH STRATEGY:
- Read the articles above carefully — they describe the EXACT nature of the crisis
- Search for crises matching the SAME specific issues (e.g. if it's food contamination, search for food contamination cases)
- Also search for crises of similar SEVERITY regardless of industry
- Look for well-documented cases from HBR, WSJ, Forbes, Reuters, Bloomberg
- Include both famous cases AND lesser-known but highly relevant ones

Be thorough. Search multiple times with different keywords. Cite your sources."""

SEARCH_2_PROMPT = """\
You are a PR and crisis communication expert with access to Google Search.

CONTEXT: We are analyzing how companies responded to crises similar to this one:
- Company under threat: {company_name}
- Crisis type: {primary_threat_category}
- Crisis summary: {crisis_summary}

HISTORICAL CRISES IDENTIFIED:
{crises_found}

YOUR TASK: For EACH historical crisis listed above, search for the EXACT PR and \
communication strategy the company deployed in response.

For each case, find:
- The SPECIFIC actions taken (public apology, CEO statement, product recall, legal attack, silence, etc.)
- The TIMELINE of the response (how quickly they reacted)
- Who led the response (CEO, PR team, legal, board)
- Any notable quotes or public statements
- Whether they changed strategy mid-crisis

Search for detailed post-mortems, case studies, and news coverage of each company's response.
Be very specific — "issued a public apology" is too vague, we need "CEO X appeared on NBC within 24h and pledged $Y million to affected customers".
Cite your sources."""

SEARCH_3_PROMPT = """\
You are a financial analyst specializing in crisis aftermath with access to Google Search.

CONTEXT: We are analyzing the consequences of crisis responses for these historical cases:
{crises_and_strategies}

YOUR TASK: For EACH case, search for the MEASURABLE OUTCOMES and long-term consequences \
of the strategy adopted.

For each case, find:
- Stock price impact (% drop, recovery timeline)
- Revenue/sales impact (quarterly or annual figures)
- Customer retention / churn data
- Legal outcomes (fines, settlements, class actions)
- Brand perception surveys or sentiment data
- How long full recovery took (months/years)
- Whether the company ultimately survived, thrived, or declined

Search for financial reports, earnings calls, analyst notes, and retrospective articles.
Prioritize QUANTITATIVE data over qualitative opinions.
Cite your sources."""


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


def _grounded_search(prompt: str, label: str) -> tuple[str, list[dict]]:
    """Execute a single Gemini call with Google Search grounding.
    Returns (text_content, list_of_sources)."""
    if not GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY missing — cannot run grounded search.")

    llm_grounded = ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        google_api_key=GOOGLE_API_KEY,
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
    Step 2.2: Run 3 sequential grounded searches.
    Returns dict with keys: crises, strategies, outcomes.
    """
    crisis_ctx = dict(
        company_name=agent1.company_name,
        primary_threat_category=agent1.primary_threat_category,
        severity_score=agent1.severity_score,
        crisis_summary=agent1.crisis_summary[:1000],
    )

    all_sources: list[dict] = []

    # Search 1: Find similar past crises
    search1_text, search1_sources = _grounded_search(
        SEARCH_1_PROMPT.format(**crisis_ctx),
        "Search 1 — Similar Past Crises",
    )
    for s in search1_sources:
        s["phase"] = "crises"
    all_sources.extend(search1_sources)

    # Search 2: Find strategies used (feeds on Search 1 results)
    search2_text, search2_sources = _grounded_search(
        SEARCH_2_PROMPT.format(
            **crisis_ctx,
            crises_found=search1_text[:8000],
        ),
        "Search 2 — Response Strategies",
    )
    for s in search2_sources:
        s["phase"] = "strategies"
    all_sources.extend(search2_sources)

    # Search 3: Find outcomes/consequences (feeds on Search 1 + 2 results)
    combined = f"CRISES:\n{search1_text[:4000]}\n\nSTRATEGIES:\n{search2_text[:4000]}"
    search3_text, search3_sources = _grounded_search(
        SEARCH_3_PROMPT.format(crises_and_strategies=combined),
        "Search 3 — Outcomes & Consequences",
    )
    for s in search3_sources:
        s["phase"] = "outcomes"
    all_sources.extend(search3_sources)

    # Deduplicate sources by URL
    seen: set[str] = set()
    unique_sources: list[dict] = []
    for s in all_sources:
        if s["url"] not in seen:
            seen.add(s["url"])
            unique_sources.append(s)

    print(f"[AGENT 2]   Total unique sources across 3 searches: {len(unique_sources)}")

    research = {
        "crises": search1_text,
        "strategies": search2_text,
        "outcomes": search3_text,
    }
    return research, unique_sources


# ---------------------------------------------------------------------------
# Step 2.3 — Extract structured cases + verify
# ---------------------------------------------------------------------------

EXTRACTOR_PROMPT = """\
You are a senior financial and PR analyst at a top-tier consulting firm.

Below is research gathered via Google Search about historical corporate crises, \
the strategies companies used to respond, and the measurable outcomes.

CURRENT CRISIS CONTEXT:
{crisis_summary}

--- RESEARCH: SIMILAR PAST CRISES ---
{crises}

--- RESEARCH: RESPONSE STRATEGIES ---
{strategies}

--- RESEARCH: OUTCOMES & CONSEQUENCES ---
{outcomes}
--- END RESEARCH ---

YOUR MISSION: Extract the 3 to 5 historical cases that are MOST analogous to \
the current crisis above. Aim for diversity — different industries, strategies, and outcomes.

For each case you MUST provide:
1. **company**: The real company name (must be mentioned in the research above)
2. **year**: The year the crisis occurred (e.g. "2015")
3. **crisis_summary**: One factual sentence about what happened
4. **crisis_title**: Short title for the crisis (e.g. "Emissions Scandal", "Data Breach")
5. **crisis_type**: Category — one of: "Product Safety", "Data & Privacy", "Regulatory & Governance", \
   "Reputation & Social", "Financial & Fraud", "Environmental", "Labor & Ethics"
6. **strategy_adopted**: The EXACT communication/PR strategy deployed (be very specific: \
   e.g. "CEO issued public apology within 24h and pledged $500M to victims" not just "apology")
7. **outcome**: Measurable result with numbers when available \
   (e.g. "Stock dropped 15% in 48h, recovered within 6 months" or "Lost 40% of customer base")
8. **success_score**: 1-10 rating (1=catastrophic failure, 5=mixed, 10=textbook crisis management)
9. **lesson**: One sentence describing the key lesson from this specific case
10. **source_url**: The URL of the primary article or source you used for this case (must be from the research)

Also provide:
- **global_lesson**: ONE strategic sentence synthesizing the key takeaway across all cases
- **confidence**: 'high' if cases have verified financial data from the research, \
  'medium' if partially sourced, 'low' if mostly estimated

CRITICAL RULES:
- Only extract cases that actually appear in the research — do NOT invent cases
- Cross-reference data between the three research sections for accuracy
- If a case lacks financial data, say so explicitly in the outcome field
- Prefer cases where all three dimensions (crisis, strategy, outcome) are well-documented"""

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
        crises=research["crises"][:15000],
        strategies=research["strategies"][:15000],
        outcomes=research["outcomes"][:15000],
    )

    output: Agent2Output = _retry_llm(lambda: structured.invoke(prompt))
    print(f"[AGENT 2]   Extraction (Pro): {time.time() - t_extract:.1f}s")

    t_verify = time.time()
    if output.past_cases and llm_flash:
        cases_text = "\n".join(
            f"Case {i+1}: {c.company} -- {c.crisis_summary} | Strategy: {c.strategy_adopted[:100]} | Outcome: {c.outcome}"
            for i, c in enumerate(output.past_cases)
        )
        all_research = "\n\n".join(
            f"--- {k.upper()} ---\n{v[:8000]}" for k, v in research.items()
        )
        verify_prompt = VERIFICATION_PROMPT.format(
            cases=cases_text,
            research=all_research,
        )
        try:
            verify_result = llm_flash.invoke(verify_prompt)
            verify_text = verify_result.content.strip().upper()
            print(f"[AGENT 2]   Verification: {verify_text[:200]}")

            if "FABRICATED" in verify_text:
                verified_cases = []
                for i, case in enumerate(output.past_cases):
                    marker = f"CASE {i+1}"
                    if marker in verify_text and "FABRICATED" in verify_text.split(marker)[-1].split("CASE")[0]:
                        print(f"[AGENT 2]   REMOVED fabricated case: {case.company}")
                    else:
                        verified_cases.append(case)

                if verified_cases:
                    output = Agent2Output(
                        past_cases=verified_cases,
                        global_lesson=output.global_lesson,
                        confidence=output.confidence if len(verified_cases) == len(output.past_cases) else "medium",
                    )
                else:
                    print("[AGENT 2]   WARNING: All cases flagged, keeping originals with low confidence")
                    output = Agent2Output(
                        past_cases=output.past_cases,
                        global_lesson=output.global_lesson,
                        confidence="low",
                    )
        except Exception as e:
            print(f"[AGENT 2]   Verification failed (non-blocking): {e}")
    print(f"[AGENT 2]   Verification (Flash): {time.time() - t_verify:.1f}s")

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
    api_cost += 0.035 * 3  # ~$35/1000 queries

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
    api_cost += 0.015  # Pro extraction
    api_cost += 0.002  # Flash verification

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

        # API cost: 3 grounded searches + Pro extraction + Flash verification
        api_cost = (0.035 * 3) + 0.015 + 0.002

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
