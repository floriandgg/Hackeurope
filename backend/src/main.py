"""
Point d'entrée — orchestration du graphe LangGraph.

Test rapide de l'Agent 1 :
    cd backend && PYTHONPATH=. python -m src.main Tesla
"""
import sys
from pathlib import Path

# S'assurer que backend/ est dans le path
_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from src.agents.agent_1_watcher.node import watcher_node


def main():
    company = sys.argv[1] if len(sys.argv) > 1 else "Tesla"
    print(f"[MAIN] Lancement Agent 1 (The Watcher) pour : {company}\n")
    state = watcher_node({"company_name": company})
    print(f"\n[MAIN] Terminé. {len(state.get('articles', []))} articles trouvés.")
    print(f"[MAIN] crisis_id: {state.get('crisis_id')}, customer_id: {state.get('customer_id')}")


if __name__ == "__main__":
    main()
