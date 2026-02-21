"""
Crisis PR Agent — FastAPI app + WebSocket.
Person 1 (Architect): Wire pipeline to WebSocket, error recovery.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Placeholder until pipeline is implemented
# from pipeline import run_pipeline_stream

app = FastAPI(title="Crisis PR Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (replace with Redis/DB for production)
sessions: dict[str, dict] = {}

# Ordner für die Startseite (ohne Node/npm)
STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.get("/", response_class=FileResponse)
async def root():
    """Startseite im Browser: http://localhost:8000"""
    return FileResponse(STATIC_DIR / "index.html")


class AnalyzeInput(BaseModel):
    input: str


@app.post("/api/analyze")
async def analyze(input_body: AnalyzeInput):
    """Start analysis; returns session_id. Client connects to /ws/{session_id}."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {"input": input_body.input, "report": {}}
    # TODO: Kick off pipeline in background; it will push to WebSocket
    return {"session_id": session_id}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if session_id not in sessions:
        await websocket.send_json({"phase": "error", "status": "error", "data": {"error": "Unknown session"}})
        await websocket.close()
        return
    try:
        # TODO: Person 1 — Stream from run_pipeline_stream(session_id, sessions[session_id]["input"])
        # For now send one mock message so frontend can develop
        await websocket.send_json({
            "phase": "recon",
            "status": "complete",
            "elapsed_seconds": 0,
            "cost": {"phase_cost": 0, "total_cost": 0, "tokens_in": 0, "tokens_out": 0},
            "data": {"message": "Pipeline not yet connected — use mock data in frontend."},
        })
        # Keep connection open until pipeline completes or timeout
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as e:
        await websocket.send_json({"phase": "error", "status": "error", "data": {"error": str(e)}})
    finally:
        await websocket.close()


@app.get("/api/sessions/{session_id}/report")
async def get_report(session_id: str):
    """Full JSON of all phases (for PDF export)."""
    if session_id not in sessions:
        return {"error": "Session not found"}
    return sessions[session_id].get("report", {})


@app.get("/api/sessions/{session_id}/export-pdf")
async def export_pdf(session_id: str):
    """Return PDF file. Person 4 implements."""
    if session_id not in sessions:
        return {"error": "Session not found"}
    # TODO: Person 4 — generate PDF from sessions[session_id]["report"]
    return {"message": "PDF export not yet implemented"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
