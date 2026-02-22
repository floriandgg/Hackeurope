"""
FastAPI server — exposes Agent 1 (The Watcher) via REST.

Run:
    cd backend && PYTHONPATH=. uvicorn src.server:app --reload --port 8000
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv

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
from src.agents.agent_5_cfo.node import cfo_from_data

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
    """Run Agent 2 + Agent 3 in PARALLEL (different API keys), then Agent 4, then Agent 5."""
    t0 = time.time()

    # --- PARALLEL: Agent 2 (GOOGLE_API_KEY) + Agent 3 (GOOGLE_API_KEY1) ---
    with ThreadPoolExecutor(max_workers=2) as pool:
        future_agent2 = pool.submit(
            precedents_node_from_topic,
            company_name=req.company_name,
            topic_name=req.topic_name,
            topic_summary=req.topic_summary,
            articles=req.articles,
        )
        future_agent3 = pool.submit(scorer_from_articles, req.articles)

        precedents_result = future_agent2.result()
        scorer_result = future_agent3.result()

    parallel_elapsed = time.time() - t0
    print(f"[SERVER] Agent 2 + Agent 3 parallel block done in {parallel_elapsed:.1f}s")

    enriched_articles = scorer_result.get("articles", [])
    total_var_impact = scorer_result.get("total_var_impact", 0.0)
    severity_score = scorer_result.get("severity_score", 0)

    prec = precedents_result.get("precedents", [])
    global_lesson = precedents_result.get("global_lesson", "")
    confidence = precedents_result.get("confidence", "low")

    # --- SEQUENTIAL: Agent 4 (needs results from both Agent 2 + 3) ---
    t1 = time.time()
    strategist_result = strategist_from_data(
        company_name=req.company_name,
        articles=enriched_articles,
        precedents=prec,
        global_lesson=global_lesson,
        confidence=confidence,
        total_var_impact=total_var_impact,
        severity_score=severity_score,
    )
    print(f"[SERVER] Agent 4 done in {time.time() - t1:.1f}s")

    # --- SEQUENTIAL: Agent 5 (needs Agent 4 result) ---
    strategy_report = strategist_result.get("strategy_report", {})
    alert_level = strategy_report.get("alert_level", "MEDIUM")
    agent4_api_cost = strategist_result.get("agent4_api_cost_eur", 0.02)

    cfo_result = cfo_from_data(
        agent2_api_cost=precedents_result.get("agent2_api_cost_eur", 0.035),
        agent3_api_cost=scorer_result.get("agent3_api_cost_eur", 0.08),
        agent4_api_cost=agent4_api_cost,
        cases_count=len(prec),
        total_var_impact=total_var_impact,
        alert_level=alert_level,
    )

    total_elapsed = time.time() - t0
    print(f"[SERVER] Full pipeline done in {total_elapsed:.1f}s")

    return {
        "strategy_report": strategy_report,
        "recommended_strategy_name": strategist_result.get("recommended_strategy_name", ""),
        "precedents": prec,
        "global_lesson": global_lesson,
        "confidence": confidence,
        "invoice": cfo_result.get("invoice", {}),
    }
