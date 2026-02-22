"""
LangGraph Node: Agent 3 — Risk Analyst.

Transforms Agent 1 qualitative scores into financial metrics:
Reach, Churn Risk, VaR (Value at Risk).
Uses dampened formulas to avoid overestimation:
- Reach: 5000 * Authority (capped at 1M), with conversion rate for acquisition loss
- Churn: correlated to Authority (exposure) and Severity
- Deduplication: multi-article VaR uses decreasing weights (1.0, 0.2, 0.1, ...)
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from src.graph.state import GraphState
from src.clients.llm_client import llm_flash_alt as llm
from src.shared.types import ArticleTopicAndViral
from src.utils.paid_helpers import emit_agent3_signal

# --- Simulation constants (Hackathon) ---

CAC = 100  # Cost per Acquired Customer in EUR
ARR = 1200  # Average Annual Revenue per Customer in EUR
TOTAL_CLIENTS = 10000  # Total customer base
REACH_CAP = 1_000_000  # Max reach for simulation
REACH_MULTIPLIER = 5000  # Was 20_000; divided by 4 to reduce overestimation
ACQUISITION_CONVERSION_RATE = 0.005  # 0.5% of reach are lost prospects
EXPOSURE_RATE = 0.1  # 10% of clients exposed to tier-1 news
CHURN_RATE_FACTOR = 0.1  # Dampening: not all exposed clients churn

# Deduplication weights: 1st article 100%, 2nd 20%, 3rd+ 10%
DEDUP_WEIGHTS = [1.0, 0.2, 0.1]

# Topic weights (default "Bank" profile)
TOPIC_WEIGHTS = {
    "security_fraud": 3.0,
    "legal_compliance": 2.0,
    "ethics_management": 1.5,
    "labor_relations": 1.6,
    "financial_performance": 1.4,
    "operational_incident": 1.3,
    "product_bug": 1.0,
    "customer_service": 0.5,
}


def _get_topic_weight(topic: str) -> float:
    """Returns topic weight, 1.0 default if unknown."""
    return TOPIC_WEIGHTS.get(topic.strip().lower(), 1.0)


def _analyze_topic_and_viral(title: str, content: str) -> ArticleTopicAndViral | None:
    """Calls Gemini to classify topic and viral coefficient."""
    if not llm:
        print("[AGENT 3] Gemini client not configured (GOOGLE_API_KEY missing).")
        return None
    structured_llm = llm.with_structured_output(ArticleTopicAndViral)
    prompt = """You are an expert in media risk analysis.

For this article, identify:
1. **topic**: One of the 5 EXACT categories (write exactly as below):
   - security_fraud: fraud, data breach, security flaw
   - legal_compliance: lawsuit, fine, legal non-compliance
   - ethics_management: greenwashing, bad management, values
   - product_bug: product bug, technical malfunction
   - customer_service: customer dissatisfaction, after-sales

2. **viral_coefficient**: Shareability (one value among 0.8, 1.2, 1.5, 2.5):
   - 0.8: Technical, financial, boring topic
   - 1.2: Simple factual info
   - 1.5: Outrage, dark humor, ecology, privacy
   - 2.5: Celebrity/Top Manager scandal, polarizing topic

Title: {title}
Excerpt: {content}

Respond only with topic and viral_coefficient.
""".format(title=title[:200], content=(content or "")[:1500])
    try:
        result = structured_llm.invoke(prompt)
        # Ensure viral_coefficient is a standard value
        v = result.viral_coefficient
        if v <= 1.0:
            result.viral_coefficient = 0.8
        elif v <= 1.35:
            result.viral_coefficient = 1.2
        elif v <= 2.0:
            result.viral_coefficient = 1.5
        else:
            result.viral_coefficient = 2.5
        return result
    except Exception as e:
        print(f"[AGENT 3] Gemini error: {e}")
        return None


def _compute_reach(authority_score: int, severity_score: int, viral_coefficient: float) -> float:
    """Reach = 5000 * Authority * (Severity/2) * ViralCoeff, capped at REACH_CAP."""
    raw = float(REACH_MULTIPLIER * authority_score * (severity_score / 2) * viral_coefficient)
    return min(raw, REACH_CAP)


def _compute_exposed_clients(authority_score: int) -> float:
    """Clients exposed to the news. Only Authority/5 * 10% of base."""
    return TOTAL_CLIENTS * (authority_score / 5.0) * EXPOSURE_RATE


def _compute_acquisition_loss(reach: float) -> float:
    """Lost prospects: 0.5% of reach would have been acquirable."""
    return reach * ACQUISITION_CONVERSION_RATE * CAC


def _compute_churn_loss(
    authority_score: int,
    severity_score: int,
    topic_weight: float,
) -> float:
    """Churn loss: exposed clients * severity * topic sensitivity * ARR * dampening."""
    exposed = _compute_exposed_clients(authority_score)
    severity_factor = severity_score / 5.0
    topic_factor = topic_weight / 10.0
    return exposed * severity_factor * topic_factor * CHURN_RATE_FACTOR * ARR


def _compute_value_at_risk(
    reach: float,
    authority_score: int,
    severity_score: int,
    topic_weight: float,
) -> float:
    """VaR = Acquisition Loss + Churn Loss (no more Reach * CAC on full audience)."""
    acquisition_loss = _compute_acquisition_loss(reach)
    churn_loss = _compute_churn_loss(authority_score, severity_score, topic_weight)
    return acquisition_loss + churn_loss


def _enrich_single_article(art: dict) -> dict | None:
    """Enrich a single article with risk metrics. Thread-safe."""
    title = art.get("title", "")
    content = art.get("content", "")
    authority_score = int(art.get("authority_score", 3))
    severity_score = int(art.get("severity_score", 2))

    topic_viral = _analyze_topic_and_viral(title, content)
    if topic_viral:
        topic_weight = _get_topic_weight(topic_viral.topic)
        viral_coefficient = float(topic_viral.viral_coefficient)
    else:
        topic_weight = 1.0
        viral_coefficient = 1.2

    reach = _compute_reach(authority_score, severity_score, viral_coefficient)
    exposed_clients = _compute_exposed_clients(authority_score)
    value_at_risk = _compute_value_at_risk(
        reach, authority_score, severity_score, topic_weight
    )

    reach = round(reach, 2)
    churn_risk_percent = round((exposed_clients / TOTAL_CLIENTS) * 100, 2)
    value_at_risk = round(value_at_risk, 2)

    print(
        f"[AGENT 3] Risk analysis: {title[:50]}... | "
        f"Reach: {reach:,.0f} | VaR: {value_at_risk:,.2f}EUR"
    )
    return {
        **art,
        "reach_estimate": reach,
        "churn_risk_percent": churn_risk_percent,
        "value_at_risk": value_at_risk,
    }


def scorer_node(state: GraphState) -> dict:
    """
    Agent 3: analyzes each article, computes Reach, Churn Risk, VaR.
    Enriches articles and computes total_var_impact.
    """
    t0 = time.time()
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    articles = list(state.get("articles", []))

    if not articles:
        print("[AGENT 3] No articles to analyze (Agent 1 did not provide articles).")
        return {
            "total_var_impact": 0.0,
            "estimated_financial_loss": 0.0,
            "severity_score": 0,
            "articles": [],
        }

    enriched_articles = []
    max_severity = 0

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_enrich_single_article, art): art for art in articles}
        for future in as_completed(futures):
            try:
                result = future.result()
                if result:
                    enriched_articles.append(result)
                    max_severity = max(max_severity, int(result.get("severity_score", 0)))
            except Exception as e:
                title = futures[future].get("title", "?")
                print(f"[AGENT 3] Error enriching '{title[:50]}': {e}")

    print(f"[AGENT 3] Parallel enrichment: {time.time() - t0:.1f}s ({len(enriched_articles)} articles)")

    # Deduplication: sort by VaR desc, apply decreasing weights (1.0, 0.2, 0.1, ...)
    sorted_by_var = sorted(enriched_articles, key=lambda a: a["value_at_risk"], reverse=True)
    total_var_impact = 0.0
    for i, art in enumerate(sorted_by_var):
        w = DEDUP_WEIGHTS[i] if i < len(DEDUP_WEIGHTS) else 0.1
        total_var_impact += art["value_at_risk"] * w
    total_var_impact = round(total_var_impact, 2)
    estimated_financial_loss = total_var_impact

    # Paid.ai signal (only if articles were analyzed)
    if enriched_articles and customer_id and crisis_id:
        api_compute_cost_eur = state.get("agent3_api_cost_eur", 0.08)
        emit_agent3_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            estimated_financial_loss=estimated_financial_loss,
            severity_score=max_severity or 3,
            api_compute_cost_eur=api_compute_cost_eur,
        )

    api_cost = len(enriched_articles) * 0.008 if enriched_articles else 0.0

    print(f"[AGENT 3] Total time: {time.time() - t0:.1f}s | VaR: {total_var_impact:,.2f}EUR")
    return {
        "articles": enriched_articles,
        "total_var_impact": total_var_impact,
        "estimated_financial_loss": estimated_financial_loss,
        "severity_score": max_severity,
        "agent3_api_cost_eur": round(api_cost, 4),
    }


def scorer_from_articles(articles: list[dict]) -> dict:
    """
    Standalone entry point for Agent 3 — called by the REST API.
    Mirrors scorer_node but takes a flat list of articles directly
    (no GraphState / customer_id / crisis_id needed).
    """
    state: GraphState = {
        "customer_id": "",
        "crisis_id": "",
        "articles": articles,
    }
    return scorer_node(state)
