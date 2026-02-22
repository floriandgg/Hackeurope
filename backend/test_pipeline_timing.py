"""Full pipeline timing test — measures Agent 2+3 parallel, Agent 4, Agent 5."""
import time
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from src.agents.agent_2_precedents.node import precedents_node_from_topic
from src.agents.agent_3_scorer.node import scorer_from_articles
from src.agents.agent_4_strategist.node import strategist_from_data
from src.agents.agent_5_cfo.node import cfo_from_data

test_articles = [
    {
        "title": "Tesla Autopilot under investigation after fatal crash",
        "summary": "NHTSA opens probe into Tesla Autopilot following fatal accident in Texas.",
        "url": "https://example.com/1",
        "content": "NHTSA investigates Tesla Autopilot crash in Texas highway.",
        "authority_score": 5,
        "severity_score": 4,
        "subject": "product_bug",
        "sentiment": "negative",
        "pub_date": "2026-02-20",
        "recency_multiplier": 1.5,
        "exposure_score": 30.0,
    },
    {
        "title": "Tesla faces class action lawsuit over battery fires",
        "summary": "Owners sue Tesla over spontaneous battery fires in Model Y.",
        "url": "https://example.com/2",
        "content": "Class action filed against Tesla for battery defects causing fires.",
        "authority_score": 4,
        "severity_score": 4,
        "subject": "legal_compliance",
        "sentiment": "negative",
        "pub_date": "2026-02-19",
        "recency_multiplier": 1.5,
        "exposure_score": 24.0,
    },
]

print("=" * 60)
print("PIPELINE TIMING TEST (Agent 2+3 parallel, then 4, then 5)")
print("=" * 60)

t_total = time.time()

# PARALLEL: Agent 2 + Agent 3
print("\n--- Agent 2 + Agent 3 (PARALLEL) ---")
t_parallel = time.time()
with ThreadPoolExecutor(max_workers=2) as pool:
    f2 = pool.submit(
        precedents_node_from_topic,
        company_name="Tesla",
        topic_name="product_bug",
        topic_summary="Autopilot investigation and battery fires",
        articles=test_articles,
    )
    f3 = pool.submit(scorer_from_articles, test_articles)
    prec_result = f2.result()
    scorer_result = f3.result()
parallel_time = time.time() - t_parallel
print(f"\n>>> Agent 2+3 parallel block: {parallel_time:.1f}s")

# SEQUENTIAL: Agent 4
print("\n--- Agent 4 (SEQUENTIAL) ---")
t4 = time.time()
strat_result = strategist_from_data(
    company_name="Tesla",
    articles=scorer_result.get("articles", []),
    precedents=prec_result.get("precedents", []),
    global_lesson=prec_result.get("global_lesson", ""),
    confidence=prec_result.get("confidence", "low"),
    total_var_impact=scorer_result.get("total_var_impact", 0),
    severity_score=scorer_result.get("severity_score", 0),
)
agent4_time = time.time() - t4
print(f">>> Agent 4: {agent4_time:.1f}s")

# Agent 5 (instant)
t5 = time.time()
cfo_result = cfo_from_data(
    agent2_api_cost=prec_result.get("agent2_api_cost_eur", 0.035),
    agent3_api_cost=scorer_result.get("agent3_api_cost_eur", 0.08),
    agent4_api_cost=strat_result.get("agent4_api_cost_eur", 0.02),
    cases_count=len(prec_result.get("precedents", [])),
    total_var_impact=scorer_result.get("total_var_impact", 0),
    alert_level=strat_result.get("strategy_report", {}).get("alert_level", "MEDIUM"),
)
agent5_time = time.time() - t5
print(f">>> Agent 5: {agent5_time:.1f}s")

total = time.time() - t_total
print("\n" + "=" * 60)
print("TIMING BREAKDOWN:")
print(f"  Agent 2+3 (parallel): {parallel_time:.1f}s")
print(f"  Agent 4:              {agent4_time:.1f}s")
print(f"  Agent 5:              {agent5_time:.1f}s")
print(f"  TOTAL:                {total:.1f}s ({total/60:.1f}min)")
print(f"  Target:               < 75s (1min 15s)")
status = "PASS" if total < 75 else "FAIL"
print(f"  Status:               {status}")
print("=" * 60)
