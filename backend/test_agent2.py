"""
Standalone test for Agent 2 — The Historical PR Strategist.

Runs Agent 1 (real) then passes the state to Agent 2.
Usage:
    cd backend
    PYTHONPATH=. python test_agent2.py Tesla
    PYTHONPATH=. python test_agent2.py "Buitoni"
"""
import sys
import json
from pathlib import Path

_backend = Path(__file__).resolve().parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_2_precedents.node import precedents_node


def main():
    company = sys.argv[1] if len(sys.argv) > 1 else "Tesla"

    print("=" * 70)
    print(f"  TEST AGENT 2 -- Real pipeline (Agent 1 -> Agent 2)")
    print(f"  Company: {company}")
    print("=" * 70)

    # --- Agent 1 ---
    print("\n[TEST] Starting Agent 1 (The Watcher)...\n")
    initial_state = {"company_name": company}
    state = {**initial_state, **watcher_node(initial_state)}
    articles = state.get("articles", [])
    print(f"\n[TEST] Agent 1 done -- {len(articles)} articles found.")

    if not articles:
        print("[TEST] No articles found, cannot run Agent 2.")
        return

    print(f"[TEST] Top article: {articles[0].get('title', '')[:80]}")
    print(f"[TEST] customer_id={state.get('customer_id')}, crisis_id={state.get('crisis_id')}")

    # --- Agent 2 ---
    print("\n" + "=" * 70)
    print("  Starting Agent 2 (The Historical PR Strategist)")
    print("=" * 70 + "\n")

    result = precedents_node(state)

    # --- Final output ---
    print("\n" + "=" * 70)
    print("  FINAL RESULT -- Agent 2 Output")
    print("=" * 70)
    output = {
        "past_cases": result.get("precedents", []),
        "global_lesson": result.get("global_lesson", ""),
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nAgent 2 API cost: {result.get('agent2_api_cost_eur', 0)} EUR")


if __name__ == "__main__":
    main()
