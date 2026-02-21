"""
LangGraph Node: Agent 3 — Risk Analyst.

Transforms Agent 1's qualitative scores into financial metrics:
Reach, Churn Risk, VaR (Value at Risk).
Emits a Paid.ai signal at the end (risk_assessment_completed).
"""
from src.graph.state import GraphState
from src.clients.llm_client import llm
from src.shared.types import ArticleTopicAndViral
from src.utils.paid_helpers import emit_agent3_signal

# --- Simulation constants (Hackathon) ---

CAC = 100  # Customer Acquisition Cost in EUR
ARR = 1200  # Average Annual Revenue per Client in EUR
TOTAL_CLIENTS = 10000  # Total client base

# Topic weights (default "Banking" profile)
TOPIC_WEIGHTS = {
    "security_fraud": 3.0,
    "legal_compliance": 2.0,
    "ethics_management": 1.5,
    "product_bug": 1.0,
    "customer_service": 0.5,
}


def _get_topic_weight(topic: str) -> float:
    """Return the topic weight, defaults to 1.0 if unknown."""
    return TOPIC_WEIGHTS.get(topic.strip().lower(), 1.0)


def _analyze_topic_and_viral(title: str, content: str) -> ArticleTopicAndViral | None:
    """Call Gemini to classify the topic and virality coefficient."""
    if not llm:
        print("[AGENT 3] WARNING: Gemini client not configured (GOOGLE_API_KEY missing).")
        return None
    structured_llm = llm.with_structured_output(ArticleTopicAndViral)
    prompt = """You are an expert in media risk analysis.

For this article, identify:
1. **topic**: One of these 5 EXACT categories (write exactly as below):
   - security_fraud: fraud, data breach, security vulnerability
   - legal_compliance: lawsuit, fine, regulatory non-compliance
   - ethics_management: greenwashing, poor management, values
   - product_bug: product bug, technical malfunction
   - customer_service: customer dissatisfaction, after-sales service

2. **viral_coefficient**: Shareability (one number among 0.8, 1.2, 1.5, 2.5):
   - 0.8: Technical, financial, boring topic
   - 1.2: Simple factual information
   - 1.5: Outrage, dark humor, ecology, privacy
   - 2.5: Celebrity/Top Manager scandal, polarizing controversy

Title: {title}
Excerpt: {content}

Respond only with topic and viral_coefficient.
""".format(title=title[:200], content=(content or "")[:1500])
    try:
        result = structured_llm.invoke(prompt)
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
    """Reach = (Authority * 20,000) * (Severity / 2) * ViralCoefficient"""
    return float((authority_score * 20_000) * (severity_score / 2) * viral_coefficient)


def _compute_churn_risk_percent(severity_score: int, topic_weight: float) -> float:
    """Churn Risk % = (Severity / 100) * Topic Weight"""
    return (severity_score / 100.0) * topic_weight


def _compute_value_at_risk(
    reach: float,
    churn_risk_percent: float,
) -> float:
    """VaR = (Reach * CAC) + ((ChurnRisk% * TOTAL_CLIENTS) * ARR)"""
    cost_marketing = reach * CAC
    clients_at_risk = churn_risk_percent * TOTAL_CLIENTS
    revenue_loss = clients_at_risk * ARR
    return cost_marketing + revenue_loss


def scorer_node(state: GraphState) -> dict:
    """
    Agent 3: analyze each article, compute Reach, Churn Risk, VaR.
    Enriches articles and computes total_var_impact.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    articles = list(state.get("articles", []))

    if not articles:
        print("[AGENT 3] No articles to analyze (Agent 1 provided none).")
        return {
            "total_var_impact": 0.0,
            "estimated_financial_loss": 0.0,
            "severity_score": 0,
            "articles": [],
        }

    total_var_impact = 0.0
    max_severity = 0
    enriched_articles = []

    for art in articles:
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
        churn_risk_decimal = _compute_churn_risk_percent(severity_score, topic_weight)
        value_at_risk = _compute_value_at_risk(reach, churn_risk_decimal)

        reach = round(reach, 2)
        churn_risk_percent = round(churn_risk_decimal * 100, 2)
        value_at_risk = round(value_at_risk, 2)

        art_enriched = {
            **art,
            "reach_estimate": reach,
            "churn_risk_percent": churn_risk_percent,
            "value_at_risk": value_at_risk,
        }
        enriched_articles.append(art_enriched)

        total_var_impact += value_at_risk
        max_severity = max(max_severity, severity_score)

        print(
            f"[AGENT 3] Risk Analysis: {title[:50]}... | "
            f"Reach: {reach:,.0f} | VaR: {value_at_risk:,.2f} EUR"
        )

    total_var_impact = round(total_var_impact, 2)
    estimated_financial_loss = total_var_impact

    if enriched_articles and customer_id and crisis_id:
        api_compute_cost_eur = state.get("agent3_api_cost_eur", 0.08)
        emit_agent3_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            estimated_financial_loss=estimated_financial_loss,
            severity_score=max_severity or 3,
            api_compute_cost_eur=api_compute_cost_eur,
        )

    return {
        "articles": enriched_articles,
        "total_var_impact": total_var_impact,
        "estimated_financial_loss": estimated_financial_loss,
        "severity_score": max_severity,
    }
