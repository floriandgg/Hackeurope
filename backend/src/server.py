"""
FastAPI server — exposes Agent 1 (The Watcher) via REST.

Run:
    cd backend && PYTHONPATH=. uvicorn src.server:app --reload --port 8000
"""
import asyncio
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from queue import Queue

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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_2_precedents.node import precedents_node_from_topic
from src.agents.agent_3_scorer.node import scorer_from_articles
from src.agents.agent_4_strategist.node import strategist_from_data
from src.agents.agent_5_cfo.node import cfo_from_data
from src.agents.agent_6_hijacker.node import hijacker_from_data
from src.utils.paid_helpers import create_checkout

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


async def _search_stream_generator(company_name: str):
    """Yields SSE events: step events then a final result event."""
    event_queue: Queue = Queue()

    def on_step(step_id: str):
        event_queue.put(("step", step_id))

    def run_watcher():
        try:
            state = watcher_node({
                "company_name": company_name,
                "on_step": on_step,
            })
            # Strip content for response
            subjects = state.get("subjects", [])
            for subj in subjects:
                for article in subj.get("articles", []):
                    article.pop("content", None)
            event_queue.put((
                "result",
                {
                    "company_name": company_name,
                    "crisis_id": state.get("crisis_id", ""),
                    "subjects": subjects,
                },
            ))
        except Exception as e:
            event_queue.put(("error", str(e)))
        finally:
            event_queue.put(("done", None))

    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=1) as ex:
        ex.submit(run_watcher)

        while True:
            try:
                msg_type, payload = await asyncio.wait_for(
                    loop.run_in_executor(None, event_queue.get),
                    timeout=300.0,
                )
            except asyncio.TimeoutError:
                yield "event: error\ndata: timeout\n\n"
                break
            if msg_type == "done":
                break
            if msg_type == "step":
                yield f"event: step\ndata: {json.dumps({'step': payload})}\n\n"
            elif msg_type == "result":
                yield f"event: result\ndata: {json.dumps(payload)}\n\n"
                break
            elif msg_type == "error":
                yield f"event: error\ndata: {json.dumps({'message': payload})}\n\n"
                break


@app.post("/api/search/stream")
async def search_stream(req: SearchRequest):
    """Run Agent 1 with Server-Sent Events for real-time step progress."""
    return StreamingResponse(
        _search_stream_generator(req.company_name),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


class HijackerRequest(BaseModel):
    company_name: str
    articles: list[dict] = []
    global_lesson: str = ""
    severity_score: int = 3


@app.post("/api/hijacker")
def hijacker(req: HijackerRequest):
    """Run Agent 6 standalone — generate landing page, deploy, simulate ads."""
    result = hijacker_from_data(
        company_name=req.company_name,
        articles=req.articles,
        global_lesson=req.global_lesson,
        severity_score=req.severity_score,
    )
    return {
        "live_url": result.get("hijacker_live_url", ""),
        "html_generated": result.get("hijacker_html_generated", False),
        "deployed": result.get("hijacker_deployed", False),
        "ads_simulated": result.get("hijacker_ads_simulated", False),
        "ads_keywords": result.get("hijacker_ads_keywords", 0),
        "ads_budget_eur": result.get("hijacker_ads_budget_eur", 0.0),
        "api_cost_eur": result.get("agent6_api_cost_eur", 0.0),
    }


class CheckoutRequest(BaseModel):
    customer_email: str
    company_name: str
    tier_name: str
    tier_price_eur: float
    crisis_id: str = ""


@app.post("/api/checkout")
def checkout(req: CheckoutRequest):
    """Create a Paid.ai order for the crisis response tier."""
    import uuid as _uuid
    crisis_id = req.crisis_id or _uuid.uuid4().hex[:8]

    result = create_checkout(
        customer_email=req.customer_email,
        company_name=req.company_name,
        tier_name=req.tier_name,
        tier_price_eur=req.tier_price_eur,
        crisis_id=crisis_id,
    )

    if result.get("error"):
        return {"success": False, "error": result["error"]}

    return {
        "success": True,
        "order_id": result["order_id"],
        "customer_id": result["customer_id"],
        "message": f"Order created for {req.tier_name} tier (EUR{req.tier_price_eur:.0f})",
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

    # --- SEQUENTIAL: Agent 6 (needs severity + global_lesson + articles) ---
    t3 = time.time()
    hijacker_result = hijacker_from_data(
        company_name=req.company_name,
        articles=enriched_articles,
        global_lesson=global_lesson,
        severity_score=severity_score,
    )
    print(f"[SERVER] Agent 6 done in {time.time() - t3:.1f}s")

    total_elapsed = time.time() - t0
    print(f"[SERVER] Full pipeline done in {total_elapsed:.1f}s")

    return {
        "strategy_report": strategy_report,
        "recommended_strategy_name": strategist_result.get("recommended_strategy_name", ""),
        "precedents": prec,
        "global_lesson": global_lesson,
        "confidence": confidence,
        "invoice": cfo_result.get("invoice", {}),
        "hijacker": {
            "live_url": hijacker_result.get("hijacker_live_url", ""),
            "html_generated": hijacker_result.get("hijacker_html_generated", False),
            "deployed": hijacker_result.get("hijacker_deployed", False),
            "ads_simulated": hijacker_result.get("hijacker_ads_simulated", False),
            "ads_keywords": hijacker_result.get("hijacker_ads_keywords", 0),
            "ads_budget_eur": hijacker_result.get("hijacker_ads_budget_eur", 0.0),
            "api_cost_eur": hijacker_result.get("agent6_api_cost_eur", 0.0),
        },
    }
