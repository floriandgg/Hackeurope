"""
LangGraph Node: Agent 1 — The Watcher.

Collects articles via Tavily, scores Authority/Severity via Gemini,
computes Recency Multiplier and Exposure Score.
Sets customer_id and crisis_id for Paid.ai (Agents 2, 3, 4).
"""
import uuid
from datetime import datetime
from dateutil import parser as date_parser

from src.graph.state import GraphState
from src.clients.tavily_client import tavily_client, search_news
from src.clients.llm_client import llm
from src.shared.types import ArticleScores, SUBJECT_KEYS, SUBJECT_DISPLAY_NAMES


# Paywall indicators: content likely truncated behind a paywall (avoid footer phrases like "subscribe to newsletter")
_PAYWALL_PATTERNS = (
    "subscribe now",
    "continue reading",
    "continue reading this article",
    "subscription required",
    "paywall",
    "subscriber-only",
    "sign in to read",
    "log in to read",
    "premium content",
    "barron's subscription",
    "wsj subscription",
)


def _is_likely_paywalled(content: str) -> bool:
    """Returns True if the content suggests the article is behind a paywall."""
    if not content or not content.strip():
        return True  # No content = treat as paywalled (unusable)
    lower = content.lower()
    return any(p in lower for p in _PAYWALL_PATTERNS)


def _recency_multiplier(pub_date_str: str | None) -> float:
    """
    Computes recency multiplier per spec:
    T < 2h  : 3.0 (Breaking News)
    T < 24h : 1.0 (Active)
    T < 48h : 0.5 (Cooling)
    T > 48h : 0.1 (Archive)
    If no date: 1.0
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
    """Calls Gemini to get summary, Authority and Severity."""
    if not llm:
        print("[AGENT 1] Gemini client not configured (GOOGLE_API_KEY missing).")
        return None
    structured_llm = llm.with_structured_output(ArticleScores)
    prompt = """You are an expert in media analysis and crisis management.

For this article, provide:
1. **is_substantive_article**: True ONLY if this is a real news article about the company. False if it's a newsletter signup page, promotional content, or mostly navigation/footer boilerplate (e.g. "Sign up for our newsletters", "Related Articles", "Subscribe and interact").
2. **summary**: A concise summary in 1-3 sentences (max 300 chars). Get to the point.
3. **subject**: One of these EXACT keys (write exactly): security_fraud, legal_compliance, ethics_management, product_bug, customer_service
   - security_fraud: fraud, data breach, security flaw
   - legal_compliance: lawsuit, fine, legal issue
   - ethics_management: greenwashing, bad management, values
   - product_bug: product defect, technical failure
   - customer_service: customer complaint, after-sales
4. **author**: Author name if visible in the excerpt, else empty string
5. **authority_score**: Score 1-5 by source (5=international, 4=national, 3=specialized, 2=blog, 1=unknown)
6. **severity_score**: Score 1-5 by severity (1=mild criticism, 2=ethical, 3=legal, 4=scandal, 5=criminal)

Article:
Title: {title}
URL: {url}
Excerpt: {content}

Respond with is_substantive_article, summary, subject, author, authority_score and severity_score.
""".format(title=title[:200], url=url, content=(content or "")[:1500])
    try:
        return structured_llm.invoke(prompt)
    except Exception as e:
        print(f"[AGENT 1] Gemini error for '{title[:50]}...': {e}")
        return None


def watcher_node(state: GraphState) -> dict:
    """
    Agent 1: collects articles (Tavily), LLM analysis (Gemini), Exposure scoring.
    Formula: Exposure Score = (Authority × Severity) × Recency Multiplier
    """
    company_name = state.get("company_name", "")
    customer_id = state.get("customer_id") or _derive_customer_id(company_name)
    crisis_id = str(uuid.uuid4())

    # --- Step A: Tavily search ---
    raw_results = search_news(company_name, max_results=10)
    if not raw_results:
        print("[AGENT 1] No articles found by Tavily.")
        return {
            "customer_id": customer_id,
            "crisis_id": crisis_id,
            "articles": [],
        "subjects": [],
        }

    # --- Étapes B, C, D : Analyse et scoring pour chaque article ---
    articles = []
    for r in raw_results:
        title = r.get("title", "")
        content = r.get("content", "")
        url = r.get("url", "")
        pub_date = r.get("pub_date")

        # Skip paywalled articles — don't recommend based on teaser only
        if _is_likely_paywalled(content):
            print(f"[AGENT 1] Skipped (paywall): {title[:60]}...")
            continue

        # Skip obvious newsletter/promo pages before calling Gemini
        _title_lower = title.lower()
        if any(x in _title_lower for x in ("sign up for", "newsletter", "get our newsletter", "subscribe to our")):
            print(f"[AGENT 1] Skipped (newsletter/promo): {title[:60]}...")
            continue

        # B: Gemini (is_substantive + summary + subject + author + Authority + Severity)
        scores = _analyze_article_with_gemini(title, content, url)
        if scores is None:
            summary = (content or "")[:300] if content else title  # fallback
            subject = "ethics_management"
            author = ""
            authority_score = 3
            severity_score = 2
        elif not getattr(scores, "is_substantive_article", True):
            print(f"[AGENT 1] Skipped (not substantive): {title[:60]}...")
            continue
        else:
            summary = (scores.summary or content or title)[:300]
            subject = scores.subject if scores.subject in SUBJECT_KEYS else "ethics_management"
            author = (scores.author or "").strip()[:200]
            authority_score = scores.authority_score
            severity_score = scores.severity_score

        # C: Recency Multiplier
        recency_mult = _recency_multiplier(pub_date)

        # D: Exposure Score formula
        exposure_score = (authority_score * severity_score) * recency_mult

        article = {
            "title": title,
            "summary": summary,
            "url": url,
            "content": content,
            "pub_date": pub_date,
            "author": author,
            "subject": subject,
            "authority_score": authority_score,
            "severity_score": severity_score,
            "recency_multiplier": recency_mult,
            "exposure_score": round(exposure_score, 2),
        }
        articles.append(article)
        print(f"[AGENT 1] Article found: {title[:60]} | Score: {article['exposure_score']}")

    # Sort by Exposure Score descending
    articles.sort(key=lambda a: a["exposure_score"], reverse=True)

    # Group by subject for frontend
    subjects_map: dict[str, list[dict]] = {}
    for a in articles:
        sub = a["subject"]
        if sub not in subjects_map:
            subjects_map[sub] = []
        subjects_map[sub].append(a)

    subjects = []
    for sub, sub_articles in subjects_map.items():
        # Summary = top article's summary (highest exposure in this subject)
        top = max(sub_articles, key=lambda x: x["exposure_score"])
        subjects.append({
            "subject": sub,
            "title": SUBJECT_DISPLAY_NAMES.get(sub, sub.replace("_", " ").title()),
            "summary": top["summary"],
            "article_count": len(sub_articles),
            "articles": sub_articles,
        })

    # Sort subjects by total exposure (sum of scores in group)
    subjects.sort(
        key=lambda s: sum(a["exposure_score"] for a in s["articles"]),
        reverse=True,
    )

    return {
        "customer_id": customer_id,
        "crisis_id": crisis_id,
        "articles": articles,  # Flat list for Agent 2, 3
        "subjects": subjects,  # Grouped for frontend
    }


def _derive_customer_id(company_name: str) -> str:
    """Derives external_customer_id if not provided."""
    return (company_name or "unknown").lower().replace(" ", "_").replace("-", "_")[:64]
