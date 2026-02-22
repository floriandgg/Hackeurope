"""
LangGraph Node: Agent 1 — The Watcher.

Collects articles via Tavily, scores Authority/Severity via Gemini,
computes Recency Multiplier and Exposure Score.
Sets customer_id and crisis_id for Paid.ai (Agents 2, 3, 4).
"""
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from dateutil import parser as date_parser

from src.graph.state import GraphState
from src.clients.tavily_client import tavily_client, search_news
from src.clients.jina_client import get_markdown_content
from src.clients.llm_client import llm
from src.shared.types import (
    ArticleScores,
    ParagraphDecisions,
    SUBJECT_KEYS,
    SUBJECT_DISPLAY_NAMES,
    SUBJECT_RISK_MULTIPLIERS,
    SENTIMENT_WEIGHTS,
)


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


def _filter_content_to_article(title: str, content: str) -> str:
    """
    Keeps only paragraphs that belong to the article (by title).
    Uses chunk-based selection: Gemini returns true/false per paragraph,
    we keep only those marked true. Text is never rewritten — only filtered.
    """
    if not content or not content.strip() or len(content) < 100:
        return content
    if not llm:
        return content

    raw = (content or "").strip()[:8000]
    paragraphs = [p.strip() for p in raw.split("\n\n") if p.strip()]

    if not paragraphs:
        return content
    if len(paragraphs) == 1:
        return content

    BATCH_SIZE = 15
    kept = []
    structured_llm = llm.with_structured_output(ParagraphDecisions)

    for start in range(0, len(paragraphs), BATCH_SIZE):
        batch = paragraphs[start : start + BATCH_SIZE]
        numbered = "\n\n".join(f"[{i+1}] {p}" for i, p in enumerate(batch))
        prompt = f"""The article is titled: "{title[:200]}"

Below are numbered paragraphs from a raw web page. Some belong to this article; others are comments, navigation, related articles, footers, or ads.

For each paragraph [1] to [{len(batch)}], output true if it belongs to the article, false otherwise.
Return exactly {len(batch)} booleans in order.

Paragraphs:
{numbered}
"""
        try:
            result = structured_llm.invoke(prompt)
            decisions = result.decisions if hasattr(result, "decisions") else []
            if len(decisions) != len(batch):
                kept.extend(batch)  # fallback: keep all if count mismatch
            else:
                for para, keep in zip(batch, decisions):
                    if keep:
                        kept.append(para)
        except Exception as e:
            print(f"[AGENT 1] Content filter error for '{title[:50]}...': {e}")
            return content

    if not kept:
        return content
    return "\n\n".join(kept)


def _is_likely_paywalled(content: str) -> bool:
    """Returns True if the content suggests the article is behind a paywall."""
    if not content or not content.strip():
        return True  # No content = treat as paywalled (unusable)
    lower = content.lower()
    return any(p in lower for p in _PAYWALL_PATTERNS)


def _recency_multiplier(pub_date_str: str | None) -> float:
    """
    Computes recency multiplier (days-based, more gradual):
    T < 2h   : 3.0 (Breaking News)
    T < 3d   : 1.5 (Fresh)
    T < 7d   : 1.2 (Recent)
    T < 30d  : 1.0 (Current)
    T > 30d  : 0.7 (Archive)
    """
    if not pub_date_str or not pub_date_str.strip():
        return 1.0
    try:
        pub = date_parser.parse(pub_date_str)
        pub_naive = pub.replace(tzinfo=None) if pub.tzinfo else pub
        delta = datetime.now() - pub_naive
        days = delta.total_seconds() / 86400
        if days < 2 / 24:  # < 2h
            return 3.0
        if days < 3:
            return 1.5
        if days < 7:
            return 1.2
        if days < 30:
            return 1.0
        return 0.7
    except (ValueError, TypeError):
        return 1.0


def _get_risk_multiplier(subject: str) -> float:
    """Returns risk multiplier for subject (1.0 default)."""
    return SUBJECT_RISK_MULTIPLIERS.get(subject.strip().lower(), 1.0)


def _analyze_article_with_gemini(
    title: str, content: str, url: str, company_name: str
) -> ArticleScores | None:
    """Calls Gemini to get summary, Authority and Severity."""
    if not llm:
        print("[AGENT 1] Gemini client not configured (GOOGLE_API_KEY missing).")
        return None
    structured_llm = llm.with_structured_output(ArticleScores)
    prompt = """You are an expert in media analysis and crisis management.

The company we are monitoring is: {company_name}

For this article, provide:
1. **is_substantive_article**: True ONLY if this is a real news article PRIMARILY about {company_name}. Set to False if: the article is about a different company (e.g. Alibaba when we search for Amazon), a newsletter signup page, promotional content, or mostly navigation/footer boilerplate (e.g. "Sign up for our newsletters", "Related Articles", "Subscribe and interact").
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
7. **sentiment**: One of: negative (critical/unfavorable), neutral (balanced/factual), positive (favorable/promotional)

Article:
Title: {title}
URL: {url}
Excerpt: {content}

Respond with is_substantive_article, summary, subject, author, authority_score, severity_score and sentiment.
""".format(
        company_name=company_name or "the company",
        title=title[:200],
        url=url,
        content=(content or "")[:1500],
    )
    try:
        return structured_llm.invoke(prompt)
    except Exception as e:
        print(f"[AGENT 1] Gemini error for '{title[:50]}...': {e}")
        return None


def _process_single_article(r: dict, company_name: str = "") -> dict | None:
    """Process one Tavily result: fetch content, analyze with Gemini, score.
    Returns article dict or None if skipped."""
    title = r.get("title", "")
    url = r.get("url", "")
    pub_date = r.get("pub_date")

    content_from_jina = get_markdown_content(url)
    if content_from_jina and len(content_from_jina.strip()) > 100:
        content = content_from_jina
    else:
        content = r.get("content", "") or ""
        content = _filter_content_to_article(title, content)

    if _is_likely_paywalled(content):
        print(f"[AGENT 1] Skipped (paywall): {title[:60]}...")
        return None

    _title_lower = title.lower()
    if any(x in _title_lower for x in ("sign up for", "newsletter", "get our newsletter", "subscribe to our")):
        print(f"[AGENT 1] Skipped (newsletter/promo): {title[:60]}...")
        return None

    scores = _analyze_article_with_gemini(title, content, url, company_name)
    if scores is None:
        summary = (content or "")[:300] if content else title
        subject = "ethics_management"
        author = ""
        authority_score = 3
        severity_score = 2
        sentiment = "neutral"
    elif not getattr(scores, "is_substantive_article", True):
        print(f"[AGENT 1] Skipped (not substantive): {title[:60]}...")
        return None
    else:
        summary = (scores.summary or content or title)[:300]
        subject = scores.subject if scores.subject in SUBJECT_KEYS else "ethics_management"
        author = (scores.author or "").strip()[:200]
        authority_score = scores.authority_score
        severity_score = scores.severity_score
        sentiment = getattr(scores, "sentiment", "neutral") or "neutral"
        sentiment = sentiment.lower().strip()
        if sentiment not in SENTIMENT_WEIGHTS:
            sentiment = "neutral"

    recency_mult = _recency_multiplier(pub_date)
    risk_mult = _get_risk_multiplier(subject)
    sentiment_weight = SENTIMENT_WEIGHTS.get(sentiment, 0.5)
    exposure_score = (
        (authority_score * severity_score)
        * risk_mult
        * recency_mult
        * sentiment_weight
    )

    return {
        "title": title,
        "summary": summary,
        "url": url,
        "content": content,
        "pub_date": pub_date,
        "author": author,
        "subject": subject,
        "sentiment": sentiment,
        "authority_score": authority_score,
        "severity_score": severity_score,
        "recency_multiplier": recency_mult,
        "exposure_score": round(exposure_score, 2),
    }


def watcher_node(state: GraphState) -> dict:
    """
    Agent 1: collects articles (Tavily), LLM analysis (Gemini), Exposure scoring.
    Formula: Exposure Score = (Authority x Severity) x Recency Multiplier
    """
    t0 = time.time()
    company_name = state.get("company_name", "")
    customer_id = state.get("customer_id") or _derive_customer_id(company_name)
    crisis_id = str(uuid.uuid4())

    # --- Step A: Tavily search ---
    t_search = time.time()
    raw_results = search_news(company_name, max_results=10)
    print(f"[AGENT 1] Tavily search: {time.time() - t_search:.1f}s ({len(raw_results or [])} results)")
    if not raw_results:
        print("[AGENT 1] No articles found by Tavily.")
        return {
            "customer_id": customer_id,
            "crisis_id": crisis_id,
            "articles": [],
            "subjects": [],
        }

    # --- Steps B, C, D: Parallel processing of all articles ---
    t_process = time.time()
    articles = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_process_single_article, r, company_name): r for r in raw_results}
        for future in as_completed(futures):
            try:
                result = future.result()
                if result is not None:
                    articles.append(result)
                    print(f"[AGENT 1] Article found: {result['title'][:60]} | Score: {result['exposure_score']}")
            except Exception as e:
                title = futures[future].get("title", "?")
                print(f"[AGENT 1] Error processing '{title[:50]}': {e}")
    print(f"[AGENT 1] Parallel article processing: {time.time() - t_process:.1f}s ({len(articles)} kept)")

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

    print(f"[AGENT 1] Total time: {time.time() - t0:.1f}s")
    return {
        "customer_id": customer_id,
        "crisis_id": crisis_id,
        "articles": articles,
        "subjects": subjects,
    }


def _derive_customer_id(company_name: str) -> str:
    """Derives external_customer_id if not provided."""
    return (company_name or "unknown").lower().replace(" ", "_").replace("-", "_")[:64]
