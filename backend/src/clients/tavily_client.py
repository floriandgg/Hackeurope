"""
Client Tavily API — recherche d'actualités.
"""
import os
from pathlib import Path
from tavily import TavilyClient
from dotenv import load_dotenv

# Charge .env depuis backend/
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None


def search_news(company_name: str, max_results: int = 10) -> list[dict]:
    """
    Recherche les actualités critiques/scandales sur une entreprise.
    Utilise topic="news" et search_depth="advanced".
    """
    if not tavily_client:
        print("[AGENT 1] ⚠️ Client Tavily non configuré (TAVILY_API_KEY manquante).")
        return []

    query = f"latest scandal or critical news about {company_name}"
    response = tavily_client.search(
        query=query,
        search_depth="advanced",
        topic="news",
        max_results=max_results,
    )

    results = []
    for r in response.get("results", []):
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "score": r.get("score", 0.0),
            "pub_date": r.get("published_date") or r.get("pub_date"),  # disponible si topic="news"
        })
    return results
