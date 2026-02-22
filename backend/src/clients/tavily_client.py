"""
Tavily API client — news search.
Bilingual (EN/FR) crisis keywords, no domain restriction for global coverage.
"""
import os
from pathlib import Path
from tavily import TavilyClient
from dotenv import load_dotenv

# Load .env (cwd, backend/, project root)
_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[2] / ".env"
_env_root = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None


CRISIS_KEYWORDS = (
    'scandal OR lawsuit OR investigation OR breach OR layoff OR outage '
    'OR "stock drop" OR "legal battle" OR controversy OR fine OR fraud '
    'OR scandale OR procès OR enquête OR amende OR licenciement OR fraude '
    'OR polémique OR condamnation OR pollution OR "mise en examen"'
)

# Well-known corporate name aliases (short name → possible official names)
_COMPANY_ALIASES: dict[str, list[str]] = {
    "total": ["TotalEnergies", "Total SE", "Total S.A."],
    "bnp": ["BNP Paribas"],
    "sg": ["Société Générale", "Societe Generale"],
    "sanofi": ["Sanofi S.A."],
    "lvmh": ["LVMH Moët Hennessy"],
    "edf": ["EDF", "Électricité de France"],
    "engie": ["Engie SA"],
    "renault": ["Renault Group", "Renault SA"],
    "stellantis": ["Stellantis N.V."],
    "carrefour": ["Carrefour SA"],
    "danone": ["Danone SA"],
    "orange": ["Orange S.A.", "Orange Telecom"],
    "airbus": ["Airbus SE"],
    "axa": ["AXA SA"],
    "credit agricole": ["Crédit Agricole"],
    "veolia": ["Veolia Environnement"],
    "bouygues": ["Bouygues SA"],
    "vinci": ["Vinci SA"],
    "safran": ["Safran SA"],
    "thales": ["Thales Group"],
    "bolloré": ["Bolloré Group", "Bollore"],
    "bollore": ["Bolloré Group"],
    "pernod": ["Pernod Ricard"],
    "loreal": ["L'Oréal"],
    "l'oréal": ["L'Oreal"],
    "hermes": ["Hermès International"],
    "hermès": ["Hermes International"],
    "kering": ["Kering SA"],
    "michelin": ["Michelin Group"],
    "alstom": ["Alstom SA"],
    "accor": ["Accor SA"],
}


def _expand_company_query(company_name: str) -> str:
    """Build a query string that covers the user-typed name + known aliases."""
    key = company_name.strip().lower()
    aliases = _COMPANY_ALIASES.get(key, [])
    names = [company_name] + aliases
    quoted = " OR ".join(f'"{n}"' for n in names)
    return f"({quoted})"


def search_news(company_name: str, max_results: int = 5) -> list[dict]:
    """
    Searches for crisis-related news about a company.
    No domain restriction — Gemini's is_substantive_article filter handles noise.
    """
    if not tavily_client:
        print("[AGENT 1] Tavily client not configured (TAVILY_API_KEY missing).")
        return []

    company_q = _expand_company_query(company_name)
    query = f'{company_q} ({CRISIS_KEYWORDS})'
    print(f"[AGENT 1] Tavily query: {query[:200]}")

    response = tavily_client.search(
        query=query,
        search_depth="advanced",
        topic="news",
        max_results=max_results,
        time_range="y",
    )

    results = []
    for r in response.get("results", []):
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "score": r.get("score", 0.0),
            "pub_date": r.get("published_date") or r.get("pub_date"),
        })
    return results
