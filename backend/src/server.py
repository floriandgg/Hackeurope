"""
FastAPI server — exposes Agent 1 (The Watcher) via REST.

Run:
    cd backend && PYTHONPATH=. uvicorn src.server:app --reload --port 8000
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env early
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
