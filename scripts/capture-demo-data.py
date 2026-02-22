"""
Capture demo data for the 3 showcase companies.

Requires the backend running on localhost:8000:
  cd backend && PYTHONPATH=. uvicorn src.server:app --reload --port 8000

Usage:
  python scripts/capture-demo-data.py

Skips files that already exist (resume-friendly).
"""

import json
import os
import sys
import time
import requests

BASE = "http://localhost:8000"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "data", "raw")

COMPANIES = ["OpenAI", "Tesla", "Apple"]

SEARCH_TIMEOUT = 180  # seconds
CRISIS_TIMEOUT = 600  # seconds — Agent 2+3+4+5 can be slow


def slug(name: str) -> str:
    return name.lower().replace(" ", "-")


def save(filename: str, data: dict) -> None:
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved {filename} ({os.path.getsize(path) / 1024:.1f} KB)")


def load(filename: str) -> dict | None:
    path = os.path.join(OUT_DIR, filename)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    # Quick health check
    try:
        requests.get(f"{BASE}/docs", timeout=5)
    except requests.ConnectionError:
        print("ERROR: Backend not running on localhost:8000")
        print("Start it with: cd backend && PYTHONPATH=. uvicorn src.server:app --reload --port 8000")
        sys.exit(1)

    for company in COMPANIES:
        company_slug = slug(company)
        print(f"\n{'='*60}")
        print(f"Capturing: {company}")
        print(f"{'='*60}")

        # Step 1: Search (Agent 1)
        search_file = f"{company_slug}-search.json"
        search_data = load(search_file)
        if search_data:
            print(f"\n[1/2] Skipping search — {search_file} exists ({len(search_data.get('subjects', []))} subjects)")
        else:
            print(f"\n[1/2] POST /api/search for {company}...")
            t0 = time.time()
            resp = requests.post(
                f"{BASE}/api/search",
                json={"company_name": company},
                timeout=SEARCH_TIMEOUT,
            )
            resp.raise_for_status()
            search_data = resp.json()
            print(f"  Done in {time.time() - t0:.1f}s — {len(search_data.get('subjects', []))} subjects")
            save(search_file, search_data)

        # Step 2: Crisis response for each subject (Agents 2+3+4+5)
        subjects = search_data.get("subjects", [])
        for i, subject in enumerate(subjects):
            crisis_file = f"{company_slug}-topic-{i}-crisis.json"
            if load(crisis_file):
                print(f"\n[2/2] Skipping topic {i} — {crisis_file} exists")
                continue

            topic_name = subject["title"]
            topic_summary = subject["summary"]
            articles = [
                {
                    "title": a["title"],
                    "summary": a["summary"],
                    "subject": a["subject"],
                    "severity_score": a["severity_score"],
                }
                for a in subject["articles"]
            ]

            print(f"\n[2/2] POST /api/crisis-response for topic {i}: {topic_name}...")
            t0 = time.time()
            try:
                resp = requests.post(
                    f"{BASE}/api/crisis-response",
                    json={
                        "company_name": company,
                        "topic_name": topic_name,
                        "topic_summary": topic_summary,
                        "articles": articles,
                    },
                    timeout=CRISIS_TIMEOUT,
                )
                resp.raise_for_status()
                crisis_data = resp.json()
                print(f"  Done in {time.time() - t0:.1f}s")
                save(crisis_file, crisis_data)
            except (requests.Timeout, requests.HTTPError) as e:
                print(f"  FAILED ({time.time() - t0:.1f}s): {e}")
                print(f"  Skipping — re-run script to retry")
                continue

    print(f"\nAll done! Files saved to {os.path.abspath(OUT_DIR)}")


if __name__ == "__main__":
    main()
