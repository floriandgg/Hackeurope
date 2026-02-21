"""
Entry point — LangGraph workflow orchestration.

Test Agent 1 only:
    cd backend && PYTHONPATH=. python -m src.main Tesla

Test Agent 1 + Agent 3 (pipeline):
    cd backend && PYTHONPATH=. python -m src.main Tesla --agent3
"""
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env early — try multiple locations (cwd, backend/, project root)
_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[1] / ".env"
_env_root = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

# Ensure backend/ is in the path
_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_3_scorer.node import scorer_node


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    run_agent3 = "--agent3" in sys.argv
    company = args[0] if args else "Tesla"

    print(f"[MAIN] Starting Agent 1 (The Watcher) for: {company}\n")
    state = watcher_node({"company_name": company})
    print(f"\n[MAIN] Agent 1 done. {len(state.get('articles', []))} articles found.")
    print("\n" + "=" * 70)
    print("AGENT 1 OUTPUT — Articles with structure (title, summary, date, scoring)")
    print("=" * 70)
    for i, a in enumerate(state.get("articles", []), 1):
        title = a.get("title", "") or ""
        summary = a.get("summary", "") or ""
        url = a.get("url", "") or ""
        print(f"\n--- Article {i} ---")
        print(f"  title:               {title[:90] + ('...' if len(title) > 90 else '')}")
        print(f"  summary:             {summary[:200] + ('...' if len(summary) > 200 else '')}")
        print(f"  pub_date:            {a.get('pub_date') or 'N/A'}")
        print(f"  author:              {a.get('author') or 'N/A'}")
        print(f"  subject:             {a.get('subject') or 'N/A'}")
        print(f"  authority_score:     {a.get('authority_score')}")
        print(f"  severity_score:      {a.get('severity_score')}")
        print(f"  recency_multiplier:  {a.get('recency_multiplier')}")
        print(f"  exposure_score:      {a.get('exposure_score')}")
        print(f"  url:                 {url[:70] + ('...' if len(url) > 70 else '')}")
        content = a.get("content", "") or ""
        if content:
            print("  content (full, with line breaks):")
            print("  " + "-" * 66)
            for line in content.splitlines():
                print(f"  {line}")
            print("  " + "-" * 66)
    print("\n" + "=" * 70)
    print("Full JSON (for debugging):")
    print(json.dumps(state, indent=2, default=str, ensure_ascii=False))
    print("=" * 70 + "\n")

    if run_agent3 and state.get("articles"):
        print("\n[MAIN] Starting Agent 3 (Risk Analyst)...\n")
        state = {**state, **scorer_node(state)}
        print(f"\n[MAIN] Agent 3 done. total_var_impact: {state.get('total_var_impact', 0):,.2f}€")
    elif run_agent3:
        print("[MAIN] No articles, Agent 3 skipped.")

    print(f"[MAIN] crisis_id: {state.get('crisis_id')}, customer_id: {state.get('customer_id')}")


if __name__ == "__main__":
    main()
