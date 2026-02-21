"""
Entry point — LangGraph workflow orchestration.

Test Agent 1 only:
    cd backend && PYTHONPATH=. python -m src.main Tesla

Test Agent 1 + Agent 3 (pipeline):
    cd backend && PYTHONPATH=. python -m src.main Tesla --agent3
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env early (backend/ or project root)
_env_backend = Path(__file__).resolve().parents[1] / ".env"
_env_root = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_backend) or load_dotenv(_env_root)

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

    if run_agent3 and state.get("articles"):
        print("\n[MAIN] Starting Agent 3 (Risk Analyst)...\n")
        state = {**state, **scorer_node(state)}
        print(f"\n[MAIN] Agent 3 done. total_var_impact: {state.get('total_var_impact', 0):,.2f}€")
    elif run_agent3:
        print("[MAIN] No articles, Agent 3 skipped.")

    print(f"[MAIN] crisis_id: {state.get('crisis_id')}, customer_id: {state.get('customer_id')}")


if __name__ == "__main__":
    main()
