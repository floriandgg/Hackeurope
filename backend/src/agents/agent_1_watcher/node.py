"""
LangGraph Node: Agent 1 — The Watcher.

Collects articles via Tavily, scores Authority/Severity via Gemini,
computes Recency Multiplier and Exposure Score.
Sets customer_id and crisis_id for Paid.ai (Agent 2, 3, 4).
"""
import uuid
from datetime import datetime
from dateutil import parser as date_parser

from src.graph.state import GraphState
from src.clients.tavily_client import tavily_client, search_news
from src.clients.llm_client import llm
from src.shared.types import ArticleScores


def _recency_multiplier(pub_date_str: str | None) -> float:
    """
    Compute recency multiplier per spec:
    T < 2h  : 3.0 (Breaking News)
    T < 24h : 1.0 (Active)
    T < 48h : 0.5 (Cold)
    T > 48h : 0.1 (Archive)
    No date : 1.0
    """
    if not pub_date_str or not pub_date_str.strip():
        return 1.0
    try:
        pub = date_parser.parse(pub_date_str)
        pub_naive = pub.replace(tzinfo=None) if pub.tzinfo else pub
        delta = datetime.now() - pub_naive
        hours = delta.total_seconds() / 3600
        if hours < 2:
            return 3.0
        if hours < 24:
            return 1.0
        if hours < 48:
            return 0.5
        return 0.1
    except (ValueError, TypeError):
        return 1.0


def _analyze_article_with_gemini(title: str, content: str, url: str) -> ArticleScores | None:
    """Call Gemini to get summary, Authority and Severity scores."""
    if not llm:
        print("[AGENT 1] WARNING: Gemini client not configured (GOOGLE_API_KEY missing).")
        return None
    structured_llm = llm.with_structured_output(ArticleScores)
    prompt = """You are an expert in media analysis and crisis management.

For this article, provide:
1. **summary**: A concise summary in 1-3 sentences (max 300 characters). Get to the point.
2. **authority_score**: Score 1-5 based on source (5=international, 4=national, 3=trade press, 2=blog, 1=unknown)
3. **severity_score**: Score 1-5 based on severity (1=mild criticism, 2=ethical, 3=legal, 4=scandal, 5=criminal)

Article:
Title: {title}
URL: {url}
Excerpt: {content}

Respond with summary (short summary), authority_score and severity_score.
""".format(title=title[:200], url=url, content=(content or "")[:1500])
    try:
        return structured_llm.invoke(prompt)
    except Exception as e:
        print(f"[AGENT 1] Gemini error for '{title[:50]}...': {e}")
        return None


def watcher_node(state: GraphState) -> dict:
    """
    Agent 1: collect articles (Tavily), LLM analysis (Gemini), Exposure scoring.
    Formula: Exposure Score = (Authority x Severity) x Recency Multiplier
    """
    company_name = state.get("company_name", "")
    customer_id = state.get("customer_id") or _derive_customer_id(company_name)
    crisis_id = str(uuid.uuid4())

    # --- Step A: Tavily Search ---
    raw_results = search_news(company_name, max_results=10)
    if not raw_results:
        print("[AGENT 1] No articles found by Tavily.")
        return {
            "customer_id": customer_id,
            "crisis_id": crisis_id,
            "articles": [],
        }

    # --- Steps B, C, D: Analysis and scoring for each article ---
    articles = []
    for r in raw_results:
        title = r.get("title", "")
        content = r.get("content", "")
        url = r.get("url", "")
        pub_date = r.get("pub_date")

        scores = _analyze_article_with_gemini(title, content, url)
        if scores is None:
            summary = (content or "")[:300] if content else title
            authority_score = 3
            severity_score = 2
        else:
            summary = (scores.summary or content or title)[:300]
            authority_score = scores.authority_score
            severity_score = scores.severity_score

        recency_mult = _recency_multiplier(pub_date)
        exposure_score = (authority_score * severity_score) * recency_mult

        article = {
            "title": title,
            "summary": summary,
            "url": url,
            "content": content,
            "pub_date": pub_date,
            "authority_score": authority_score,
            "severity_score": severity_score,
            "recency_multiplier": recency_mult,
            "exposure_score": round(exposure_score, 2),
        }
        articles.append(article)
        print(f"[AGENT 1] Article found: {title[:60]} | Score: {article['exposure_score']}")

    articles.sort(key=lambda a: a["exposure_score"], reverse=True)

    return {
        "customer_id": customer_id,
        "crisis_id": crisis_id,
        "articles": articles,
    }


def _derive_customer_id(company_name: str) -> str:
    """Derive an external_customer_id if not provided."""
    return (company_name or "unknown").lower().replace(" ", "_").replace("-", "_")[:64]
