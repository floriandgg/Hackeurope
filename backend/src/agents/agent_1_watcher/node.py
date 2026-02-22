"""
LangGraph Node: Agent 1 — The Watcher.

Collects articles via Tavily, scores Authority/Severity via Gemini,
computes Recency Multiplier and Exposure Score.
Sets customer_id and crisis_id for Paid.ai (Agents 2, 3, 4).
"""
import time
import uuid
from datetime import datetime
from dateutil import parser as date_parser

from src.graph.state import GraphState
from src.clients.tavily_client import tavily_client, search_news, _COMPANY_ALIASES
from src.clients.llm_client import llm
from src.shared.types import (
    ArticleScores,
    ArticleClusteringResult,
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


# Noise patterns that often appear in off-topic search results
_TITLE_BLACKLIST = (
    "refinery",
    "kazakhstan",
    "warner bros",
    "stock market overview",
    "market roundup",
    "daily digest",
)


def _validate_result(article_title: str, company_name: str) -> bool:
    """
    Pre-filter: reject articles that don't mention the company (or its aliases) or match known noise.
    Saves Jina/Gemini calls for clearly irrelevant results.
    """
    if not article_title or not company_name:
        return False
    title_lower = article_title.lower()
    company_lower = company_name.lower()

    # Build list of accepted name variants
    names_to_check = [company_lower]
    aliases = _COMPANY_ALIASES.get(company_lower, [])
    names_to_check.extend(a.lower() for a in aliases)

    # At least one variant must appear in the title
    if not any(name in title_lower for name in names_to_check):
        return False
    # Blacklist noisy patterns
    if any(word in title_lower for word in _TITLE_BLACKLIST):
        return False
    return True


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
3. **subject**: Use the MOST SPECIFIC category. One of: security_fraud, legal_compliance, ethics_management, labor_relations, financial_performance, operational_incident, product_bug, customer_service
   - security_fraud: fraud, data breach, security flaw
   - legal_compliance: lawsuit, fine, regulatory action
   - ethics_management: greenwashing, values, governance (NOT layoffs)
   - labor_relations: layoffs, job cuts, workforce reduction, labor disputes
   - financial_performance: stock drop, earnings miss, market impact
   - operational_incident: outage, system failure, supply chain disruption
   - product_bug: product defect, technical failure
   - customer_service: customer complaint, after-sales
4. **author**: Author name if visible in the excerpt, else empty string
5. **authority_score**: Score 1-5 by source (5=international, 4=national, 3=specialized, 2=blog, 1=unknown)
6. **severity_score**: Score 1-5 by severity (1=mild criticism, 2=ethical, 3=legal, 4=scandal, 5=criminal)
7. **sentiment**: One of: negative (critical/unfavorable), neutral (balanced/factual), positive (favorable/promotional)
8. **sub_theme**: A short 2-6 word phrase for the SPECIFIC angle or focus of this article. INVENT a distinct sub-theme to differentiate it (e.g. "Layoff email blunder", "Mass job cuts scale", "CEO documentary backlash", "Employee communication mishap"). Use varied angles so articles don't all get the same sub_theme.

Article:
Title: {title}
URL: {url}
Excerpt: {content}

Respond with is_substantive_article, summary, subject, sub_theme, author, authority_score, severity_score and sentiment.
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


def _cluster_articles_with_gemini(articles: list[dict], max_per_cluster: int = 3) -> list[dict] | None:
    """
    Single Gemini call: groups all articles into thematic clusters (max 3 per cluster).
    Returns a list of {title, articles} dicts, or None on failure (caller falls back).
    """
    if not llm or len(articles) <= 1:
        return None

    structured_llm = llm.with_structured_output(ArticleClusteringResult)
    numbered = "\n".join(
        f"[{i}] {a.get('title', '')} — {(a.get('summary') or '')[:120]}"
        for i, a in enumerate(articles)
    )
    n = len(articles)
    prompt = f"""You have {n} news articles about the same company. Group them into thematic clusters where each cluster shares a meaningful crisis angle.

Rules:
- Maximum {max_per_cluster} articles per cluster.
- Every article must appear in exactly one cluster.
- Give each cluster a short, specific 2-5 word title (e.g. "Layoff Email Blunder", "Mass Job Cuts Scale", "CEO Priorities Backlash").
- Articles covering genuinely different angles should be in different clusters.

Articles:
{numbered}

Return the clusters with their titles and the article indices (0-based) they contain."""
    try:
        result = structured_llm.invoke(prompt)
        # Validate: every index appears exactly once
        seen = set()
        clusters_out = []
        for cluster in result.clusters:
            valid_idx = [i for i in cluster.article_indices if 0 <= i < n and i not in seen]
            seen.update(valid_idx)
            if valid_idx:
                chunk_articles = [articles[i] for i in valid_idx]
                top = max(chunk_articles, key=lambda x: x["exposure_score"])
                clusters_out.append({
                    "subject": cluster.title.lower().replace(" ", "_")[:40],
                    "title": cluster.title,
                    "summary": top["summary"],
                    "article_count": len(chunk_articles),
                    "articles": chunk_articles,
                })
        return clusters_out if clusters_out else None
    except Exception as e:
        print(f"[AGENT 1] Clustering error: {e}")
        return None


# Step IDs for real-time UI sync (must match frontend AGENT_STEPS order)
STEP_INITIALIZING = "initializing"
STEP_SCANNING = "scanning_news"
STEP_ANALYZING = "analyzing_sentiment"
STEP_CROSS_REFERENCING = "cross_referencing"
STEP_EVALUATING = "evaluating_criticality"
STEP_COMPILING = "compiling_results"


def watcher_node(state: GraphState) -> dict:
    """
    Agent 1: collects articles (Tavily), LLM analysis (Gemini), Exposure scoring.
    Formula: Exposure Score = (Authority × Severity) × Recency Multiplier.
    Calls on_step(step_id) when provided in state for real-time UI sync.
    """
    t0 = time.time()
    company_name = state.get("company_name", "")
    customer_id = state.get("customer_id") or _derive_customer_id(company_name)
    crisis_id = str(uuid.uuid4())
    on_step = state.get("on_step")  # optional: callable[[str], None]

    def _emit(step_id: str) -> None:
        if callable(on_step):
            try:
                on_step(step_id)
            except Exception:
                pass

    _emit(STEP_INITIALIZING)

    # --- Step A: Tavily search ---
    raw_results = search_news(company_name, max_results=5)
    _emit(STEP_SCANNING)
    if not raw_results:
        print("[AGENT 1] No articles found by Tavily.")
        _emit(STEP_COMPILING)
        return {
            "customer_id": customer_id,
            "crisis_id": crisis_id,
            "articles": [],
            "subjects": [],
        }

    # --- Étapes B, C, D : Analyse et scoring pour chaque article ---
    _emit(STEP_ANALYZING)
    articles = []
    for r in raw_results:
        title = r.get("title", "")
        url = r.get("url", "")
        pub_date = r.get("pub_date")

        # Pre-filter: skip articles that don't mention the company or match noise patterns
        if not _validate_result(title, company_name):
            print(f"[AGENT 1] Skipped (validation): {title[:60]}...")
            continue

        # Use Tavily content only (Jina disabled for speed — Tavily snippets are sufficient)
        content = r.get("content", "") or ""

        # Keep articles even if paywalled — we return the 5 most relevant regardless

        # Skip obvious newsletter/promo pages before calling Gemini
        _title_lower = title.lower()
        if any(x in _title_lower for x in ("sign up for", "newsletter", "get our newsletter", "subscribe to our")):
            print(f"[AGENT 1] Skipped (newsletter/promo): {title[:60]}...")
            continue

        # B: Gemini (is_substantive + summary + subject + author + Authority + Severity)
        scores = _analyze_article_with_gemini(title, content, url, company_name)
        if scores is None:
            summary = (content or "")[:300] if content else title  # fallback
            subject = "ethics_management"
            sub_theme = None
            author = ""
            authority_score = 3
            severity_score = 2
            sentiment = "neutral"
        elif not getattr(scores, "is_substantive_article", True):
            print(f"[AGENT 1] Skipped (not substantive): {title[:60]}...")
            continue
        else:
            summary = (scores.summary or content or title)[:300]
            subject = scores.subject if scores.subject in SUBJECT_KEYS else "ethics_management"
            sub_theme = (getattr(scores, "sub_theme", "") or "").strip()[:80] or None
            author = (scores.author or "").strip()[:200]
            authority_score = scores.authority_score
            severity_score = scores.severity_score
            sentiment = getattr(scores, "sentiment", "neutral") or "neutral"
            sentiment = sentiment.lower().strip()
            if sentiment not in SENTIMENT_WEIGHTS:
                sentiment = "neutral"

        # C: Recency Multiplier (days-based)
        recency_mult = _recency_multiplier(pub_date)

        # D: Exposure Score formula
        # base × risk_mult × recency × sentiment_weight (asymmetric: negative full, positive 0.1)
        risk_mult = _get_risk_multiplier(subject)
        sentiment_weight = SENTIMENT_WEIGHTS.get(sentiment, 0.5)
        exposure_score = (
            (authority_score * severity_score)
            * risk_mult
            * recency_mult
            * sentiment_weight
        )

        article = {
            "title": title,
            "summary": summary,
            "url": url,
            "content": content,
            "pub_date": pub_date,
            "author": author,
            "subject": subject,
            "sub_theme": sub_theme,
            "sentiment": sentiment,
            "authority_score": authority_score,
            "severity_score": severity_score,
            "recency_multiplier": recency_mult,
            "exposure_score": round(exposure_score, 2),
        }
        articles.append(article)
        print(f"[AGENT 1] Article found: {title} | Score: {article['exposure_score']}")

    _emit(STEP_CROSS_REFERENCING)

    # Sort by Exposure Score descending
    articles.sort(key=lambda a: a["exposure_score"], reverse=True)
    _emit(STEP_EVALUATING)

    # Cluster articles with Gemini (single call, max 3 per cluster)
    subjects = _cluster_articles_with_gemini(articles, max_per_cluster=3) or []

    # Fallback: if clustering failed, group by subject
    if not subjects:
        subjects_map: dict[str, list[dict]] = {}
        for a in articles:
            sub = a.get("subject", "other")
            if sub not in subjects_map:
                subjects_map[sub] = []
            subjects_map[sub].append(a)
        for sub, sub_articles in subjects_map.items():
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

    _emit(STEP_COMPILING)
    return {
        "customer_id": customer_id,
        "crisis_id": crisis_id,
        "articles": articles,
        "subjects": subjects,
    }


def _derive_customer_id(company_name: str) -> str:
    """Derives external_customer_id if not provided."""
    return (company_name or "unknown").lower().replace(" ", "_").replace("-", "_")[:64]
