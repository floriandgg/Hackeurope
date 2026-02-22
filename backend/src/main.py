"""
Entry point — Full pipeline test runner.

Usage:
    cd backend
    PYTHONPATH=. python -m src.main Tesla
    PYTHONPATH=. python -m src.main "Volkswagen" --skip-agent2   # skip slow precedent search
"""
import json
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv

_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[1] / ".env"
_env_root = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_2_precedents.node import precedents_node
from src.agents.agent_3_scorer.node import scorer_node
from src.agents.agent_4_strategist.node import strategist_node

SEP = "=" * 80


def _dump(label: str, data):
    print(f"\n{SEP}")
    print(f"  {label}")
    print(SEP)
    print(json.dumps(data, indent=2, default=str, ensure_ascii=False))
    print(SEP)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    skip_agent2 = "--skip-agent2" in sys.argv
    company = args[0] if args else "Tesla"

    state: dict = {"company_name": company}

    # ── Agent 1 ─────────────────────────────────────────────
    print(f"\n{'#' * 80}")
    print(f"#  AGENT 1 — The Watcher  |  Company: {company}")
    print(f"{'#' * 80}\n")
    t0 = time.time()
    result1 = watcher_node(state)
    state.update(result1)
    elapsed1 = time.time() - t0

    print(f"\n[MAIN] Agent 1 done in {elapsed1:.1f}s — {len(state.get('articles', []))} articles found")

    for i, a in enumerate(state.get("articles", []), 1):
        print(f"\n  --- Article {i} ---")
        print(f"  Title:      {a.get('title', '')}")
        print(f"  Subject:    {a.get('subject', '')}  |  Authority: {a.get('authority_score')}/5  |  Severity: {a.get('severity_score')}/5")
        print(f"  Exposure:   {a.get('exposure_score')}  (recency x{a.get('recency_multiplier')})")
        print(f"  Summary:    {(a.get('summary', '') or '')[:200]}")
        print(f"  URL:        {a.get('url', '')}")

    _dump("AGENT 1 — RAW STATE (articles + subjects)", {
        "customer_id": state.get("customer_id"),
        "crisis_id": state.get("crisis_id"),
        "article_count": len(state.get("articles", [])),
        "subject_count": len(state.get("subjects", [])),
        "subjects": [
            {"subject": s.get("subject"), "title": s.get("title"), "article_count": s.get("article_count")}
            for s in state.get("subjects", [])
        ],
    })

    if not state.get("articles"):
        print("\n[MAIN] No articles found. Pipeline stops here.")
        return

    # ── Agent 2 + Agent 3 (parallel) ───────────────────────
    print(f"\n{'#' * 80}")
    print(f"#  AGENT 2 (Precedents) {'[SKIPPED]' if skip_agent2 else ''} + AGENT 3 (Scorer)  —  Running {'sequentially' if skip_agent2 else 'in parallel'}...")
    print(f"{'#' * 80}\n")

    result2 = {}
    result3 = {}
    t0 = time.time()

    if skip_agent2:
        result3 = scorer_node(state)
        result2 = {
            "precedents": [],
            "global_lesson": "(Agent 2 skipped)",
            "confidence": "low",
            "agent2_sources": [],
        }
    else:
        with ThreadPoolExecutor(max_workers=2) as pool:
            future2 = pool.submit(precedents_node, state)
            future3 = pool.submit(scorer_node, state)
            for f in as_completed([future2, future3]):
                if f is future2:
                    result2 = f.result()
                    print(f"[MAIN] Agent 2 finished — {len(result2.get('precedents', []))} precedents")
                else:
                    result3 = f.result()
                    print(f"[MAIN] Agent 3 finished — total VaR: {result3.get('total_var_impact', 0):,.2f}EUR")

    state.update(result2)
    state.update(result3)
    elapsed23 = time.time() - t0

    print(f"\n[MAIN] Agent 2 + 3 done in {elapsed23:.1f}s")

    # Agent 2 output
    _dump("AGENT 2 — PRECEDENTS", {
        "global_lesson": state.get("global_lesson"),
        "confidence": state.get("confidence"),
        "precedents": state.get("precedents", []),
        "sources_count": len(state.get("agent2_sources", [])),
    })

    # Agent 3 output
    _dump("AGENT 3 — RISK SCORES", {
        "total_var_impact": state.get("total_var_impact"),
        "severity_score": state.get("severity_score"),
        "articles_enriched": [
            {
                "title": a.get("title", "")[:60],
                "reach_estimate": a.get("reach_estimate"),
                "churn_risk_percent": a.get("churn_risk_percent"),
                "value_at_risk": a.get("value_at_risk"),
            }
            for a in state.get("articles", [])
        ],
    })

    # ── Agent 4 ─────────────────────────────────────────────
    print(f"\n{'#' * 80}")
    print(f"#  AGENT 4 — The Strategist")
    print(f"{'#' * 80}\n")
    t0 = time.time()
    result4 = strategist_node(state)
    state.update(result4)
    elapsed4 = time.time() - t0

    print(f"\n[MAIN] Agent 4 done in {elapsed4:.1f}s")

    report = state.get("strategy_report", {})

    _dump("AGENT 4 — DECISION", {
        "alert_level": report.get("alert_level"),
        "alert_reasoning": report.get("alert_reasoning"),
        "recommended_action": report.get("recommended_action"),
        "recommended_strategy": report.get("recommended_strategy"),
        "recommendation_reasoning": report.get("recommendation_reasoning"),
        "decision_summary": report.get("decision_summary"),
    })

    _dump("AGENT 4 — 3 STRATEGIES", report.get("strategies", []))

    _dump("AGENT 4 — PRESS RELEASE", report.get("press_release", ""))
    _dump("AGENT 4 — INTERNAL EMAIL", report.get("internal_email", ""))
    _dump("AGENT 4 — SOCIAL POST", report.get("social_post", ""))
    if report.get("legal_notice_draft"):
        _dump("AGENT 4 — LEGAL NOTICE", report.get("legal_notice_draft", ""))

    # ── Summary ─────────────────────────────────────────────
    print(f"\n{'#' * 80}")
    print(f"#  PIPELINE SUMMARY")
    print(f"{'#' * 80}")
    print(f"  Company:              {company}")
    print(f"  Articles found:       {len(state.get('articles', []))}")
    print(f"  Precedents found:     {len(state.get('precedents', []))}")
    print(f"  Total VaR:            EUR {state.get('total_var_impact', 0):,.2f}")
    print(f"  Alert Level:          {report.get('alert_level', 'N/A')}")
    print(f"  Recommended Strategy: {report.get('recommended_strategy', 'N/A')}")
    print(f"  Drafts Generated:     {state.get('drafts_generated', 0)}")
    print(f"  Total time:           {elapsed1 + elapsed23 + elapsed4:.1f}s")
    print(f"{'#' * 80}\n")


if __name__ == "__main__":
    main()
