"""
Entry point — LangGraph pipeline orchestration.

Test Agent 1 only:
    cd backend && PYTHONPATH=. python -m src.main Tesla

Test Agent 1 + Agent 2:
    cd backend && PYTHONPATH=. python -m src.main Tesla --agent2

Test Agent 1 + Agent 3:
    cd backend && PYTHONPATH=. python -m src.main Tesla --agent3

Test Agent 1 + Agent 2 + Agent 3:
    cd backend && PYTHONPATH=. python -m src.main Tesla --agent2 --agent3
"""
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_2_precedents.node import precedents_node
from src.agents.agent_3_scorer.node import scorer_node


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    run_agent2 = "--agent2" in sys.argv
    run_agent3 = "--agent3" in sys.argv
    company = args[0] if args else "Tesla"

    print(f"[MAIN] Starting Agent 1 (The Watcher) for: {company}\n")
    state = watcher_node({"company_name": company})
    print(f"\n[MAIN] Agent 1 done. {len(state.get('articles', []))} articles found.")

    if not state.get("articles"):
        print("[MAIN] No articles found, pipeline stopped.")
        return

    if run_agent2:
        print("\n[MAIN] Starting Agent 2 (Historical PR Strategist)...\n")
        state = {**state, **precedents_node(state)}
        cases = state.get("precedents", [])
        print(f"\n[MAIN] Agent 2 done. {len(cases)} historical cases found.")

    if run_agent3:
        print("\n[MAIN] Starting Agent 3 (Risk Analyst)...\n")
        state = {**state, **scorer_node(state)}
        print(f"\n[MAIN] Agent 3 done. total_var_impact: {state.get('total_var_impact', 0):,.2f} EUR")

    print(f"[MAIN] crisis_id: {state.get('crisis_id')}, customer_id: {state.get('customer_id')}")


if __name__ == "__main__":
    main()
