"""
Nœud LangGraph : Agent 1 — The Watcher.

Collecte articles via Tavily, scoring Authority/Severity via Gemini,
calcul du Recency Multiplier et Exposure Score.
Définit customer_id et crisis_id pour Paid.ai (Agent 2, 3, 4).
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
    Calcule le multiplicateur de récence selon la spécification :
    T < 2h  : 3.0 (Breaking News)
    T < 24h : 1.0 (Actif)
    T < 48h : 0.5 (Froid)
    T > 48h : 0.1 (Archive)
    Si pas de date : 1.0
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
    """Appelle Gemini pour obtenir résumé, Authority et Severity."""
    if not llm:
        print("[AGENT 1] ⚠️ Client Gemini non configuré (GOOGLE_API_KEY manquante).")
        return None
    structured_llm = llm.with_structured_output(ArticleScores)
    prompt = """Tu es un expert en analyse médiatique et en gestion de crise.

Pour cet article, fournis :
1. **summary** : Un résumé concis en 1 à 3 phrases (max 300 caractères). Va à l'essentiel.
2. **authority_score** : Score 1-5 selon la source (5=international, 4=national, 3=spécialisée, 2=blog, 1=inconnu)
3. **severity_score** : Score 1-5 selon la gravité (1=avis négatif, 2=éthique, 3=légal, 4=scandale, 5=criminel)

Article :
Titre : {title}
URL : {url}
Extrait : {content}

Réponds avec summary (résumé court), authority_score et severity_score.
""".format(title=title[:200], url=url, content=(content or "")[:1500])
    try:
        return structured_llm.invoke(prompt)
    except Exception as e:
        print(f"[AGENT 1] Erreur Gemini pour '{title[:50]}...' : {e}")
        return None


def watcher_node(state: GraphState) -> dict:
    """
    Agent 1 : collecte articles (Tavily), analyse LLM (Gemini), scoring Exposure.
    Formule : Exposure Score = (Authority × Severity) × Recency Multiplier
    """
    company_name = state.get("company_name", "")
    customer_id = state.get("customer_id") or _derive_customer_id(company_name)
    crisis_id = str(uuid.uuid4())

    # --- Étape A : Recherche Tavily ---
    raw_results = search_news(company_name, max_results=10)
    if not raw_results:
        print("[AGENT 1] Aucun article trouvé par Tavily.")
        return {
            "customer_id": customer_id,
            "crisis_id": crisis_id,
            "articles": [],
        }

    # --- Étapes B, C, D : Analyse et scoring pour chaque article ---
    articles = []
    for r in raw_results:
        title = r.get("title", "")
        content = r.get("content", "")
        url = r.get("url", "")
        pub_date = r.get("pub_date")

        # B : Gemini (résumé + Authority + Severity)
        scores = _analyze_article_with_gemini(title, content, url)
        if scores is None:
            summary = (content or "")[:300] if content else title  # fallback
            authority_score = 3
            severity_score = 2
        else:
            summary = (scores.summary or content or title)[:300]
            authority_score = scores.authority_score
            severity_score = scores.severity_score

        # C : Recency Multiplier
        recency_mult = _recency_multiplier(pub_date)

        # D : Formule finale
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
        print(f"[AGENT 1] Article trouvé : {title[:60]} | Score : {article['exposure_score']}")

    # Tri par Exposure Score décroissant
    articles.sort(key=lambda a: a["exposure_score"], reverse=True)

    return {
        "customer_id": customer_id,
        "crisis_id": crisis_id,
        "articles": articles,
    }


def _derive_customer_id(company_name: str) -> str:
    """Dérive un external_customer_id si non fourni."""
    return (company_name or "unknown").lower().replace(" ", "_").replace("-", "_")[:64]
