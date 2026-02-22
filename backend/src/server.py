"""
FastAPI server — exposes Agent 1 (The Watcher) via REST.

Run:
    cd backend && PYTHONPATH=. uvicorn src.server:app --reload --port 8000
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env early
_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[1] / ".env"
_env_root = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_2_precedents.node import precedents_node_from_topic
from src.agents.agent_3_scorer.node import scorer_from_articles
from src.agents.agent_4_strategist.node import strategist_from_data

app = FastAPI(title="Crisis PR Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    company_name: str


@app.post("/api/search")
def search(req: SearchRequest):
    """Run Agent 1 and return grouped subjects for the frontend."""
    state = watcher_node({"company_name": req.company_name})

    # Strip heavy "content" field from articles to keep response light
    subjects = state.get("subjects", [])
    for subj in subjects:
        for article in subj.get("articles", []):
            article.pop("content", None)

    return {
        "company_name": req.company_name,
        "crisis_id": state.get("crisis_id", ""),
        "subjects": subjects,
    }


class PrecedentsRequest(BaseModel):
    company_name: str
    topic_name: str
    topic_summary: str
    articles: list[dict] = []


@app.post("/api/precedents")
def precedents(req: PrecedentsRequest):
    """Run Agent 2 for a specific topic and return historical precedents."""
    result = precedents_node_from_topic(
        company_name=req.company_name,
        topic_name=req.topic_name,
        topic_summary=req.topic_summary,
        articles=req.articles,
    )
    return {
        "precedents": result["precedents"],
        "global_lesson": result["global_lesson"],
        "confidence": result["confidence"],
    }


class CrisisResponseRequest(BaseModel):
    company_name: str
    topic_name: str
    topic_summary: str
    articles: list[dict] = []


@app.post("/api/crisis-response")
def crisis_response(req: CrisisResponseRequest):
    """Run Agent 3 + Agent 2 + Agent 4 and return the full crisis response."""
    # Step 1: Agent 3 — enrich articles with financial risk metrics
    scorer_result = scorer_from_articles(req.articles)
    enriched_articles = scorer_result.get("articles", [])
    total_var_impact = scorer_result.get("total_var_impact", 0.0)
    severity_score = scorer_result.get("severity_score", 0)

    # Step 2: Agent 2 — find historical precedents
    precedents_result = precedents_node_from_topic(
        company_name=req.company_name,
        topic_name=req.topic_name,
        topic_summary=req.topic_summary,
        articles=req.articles,
    )
    prec = precedents_result.get("precedents", [])
    global_lesson = precedents_result.get("global_lesson", "")
    confidence = precedents_result.get("confidence", "low")

    # Step 3: Agent 4 — generate strategies + drafts
    strategist_result = strategist_from_data(
        company_name=req.company_name,
        articles=enriched_articles,
        precedents=prec,
        global_lesson=global_lesson,
        confidence=confidence,
        total_var_impact=total_var_impact,
        severity_score=severity_score,
    )

    return {
        "strategy_report": strategist_result.get("strategy_report", {}),
        "recommended_strategy_name": strategist_result.get("recommended_strategy_name", ""),
        "precedents": prec,
        "global_lesson": global_lesson,
        "confidence": confidence,
    }
