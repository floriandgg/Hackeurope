"""
Point d'entrée — orchestration du graphe LangGraph.

Test Agent 1 seul :
    cd backend && PYTHONPATH=. python -m src.main Tesla

Test Agent 1 + Agent 3 (pipeline) :
    cd backend && PYTHONPATH=. python -m src.main Tesla --agent3
"""
import sys
from pathlib import Path

# S'assurer que backend/ est dans le path
_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from src.agents.agent_1_watcher.node import watcher_node
from src.agents.agent_3_scorer.node import scorer_node


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    run_agent3 = "--agent3" in sys.argv
    company = args[0] if args else "Tesla"

    print(f"[MAIN] Lancement Agent 1 (The Watcher) pour : {company}\n")
    state = watcher_node({"company_name": company})
    print(f"\n[MAIN] Agent 1 terminé. {len(state.get('articles', []))} articles trouvés.")

    if run_agent3 and state.get("articles"):
        print("\n[MAIN] Lancement Agent 3 (Risk Analyst)...\n")
        state = {**state, **scorer_node(state)}
        print(f"\n[MAIN] Agent 3 terminé. total_var_impact: {state.get('total_var_impact', 0):,.2f}€")
    elif run_agent3:
        print("[MAIN] Pas d'articles, Agent 3 ignoré.")

    print(f"[MAIN] crisis_id: {state.get('crisis_id')}, customer_id: {state.get('customer_id')}")


if __name__ == "__main__":
    main()
