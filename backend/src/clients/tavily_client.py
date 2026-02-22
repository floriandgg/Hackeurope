"""
Tavily API client — news search.
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


def search_news(company_name: str, max_results: int = 10) -> list[dict]:
    """
    Searches for critical/scandal news about a company.
    Uses topic="news" and search_depth="advanced".
    """
    if not tavily_client:
        print("[AGENT 1] Tavily client not configured (TAVILY_API_KEY missing).")
        return []

    query = f'latest scandal or critical news about "{company_name}"'
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
            "pub_date": r.get("published_date") or r.get("pub_date"),  # available if topic="news"
        })
    return results
