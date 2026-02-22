"""
LangGraph Node: Agent 6 — The Narrative Hijacker.

Autonomous PR war machine. When a crisis is confirmed (severity >= 3),
this agent:
1. Generates a branded crisis "Truth Landing Page" (HTML/Tailwind) via LLM.
2. Deploys it live on the web via Vercel's REST API.
3. Simulates programmatic Google Ads keyword hijacking (mock).
4. Returns the live URL for the rest of the pipeline.
"""
from __future__ import annotations

import os
import time
import traceback
from typing import Any

import requests

from src.graph.state import GraphState
from src.clients.llm_client import llm_pro_alt as llm_pro, llm_flash_alt as llm_flash


MAX_LLM_RETRIES = 3
SEVERITY_THRESHOLD = 3

LANDING_PAGE_SYSTEM_PROMPT = """\
You are a Front-End developer and a crisis communications expert.
Write a single-file Landing Page in HTML (index.html), using Tailwind CSS
via CDN (<script src="https://cdn.tailwindcss.com"></script>).

The page MUST contain:
- An official alert banner at the top (corporate blue/navy, not red — this is reassurance, not panic).
- A reassuring, authoritative headline.
- A transparent summary of the situation: {crisis_summary}
- Immediate corrective measures inspired by: {historical_lesson}
- A "Frequently Asked Questions" section with 3 plausible Q&As.
- A footer with a generic "Media Contact" email and current year.

Design constraints:
- Elegant, corporate, inspires trust and professionalism.
- Fully responsive (mobile-first, looks great on all screen sizes).
- Use a restrained color palette: navy (#1e3a5f), white, light gray (#f3f4f6), accent blue (#3b82f6).
- Professional typography via Google Fonts (Inter).
- Include a <meta charset="UTF-8"> and <meta name="viewport"> tag.

Return ONLY raw HTML code. No markdown, no ```html fences, no explanation."""

LANDING_PAGE_USER_PROMPT = """\
Company: {company_name}

Crisis Summary:
{crisis_summary}

Historical Lesson (basis for corrective measures):
{historical_lesson}

Generate the complete HTML landing page now."""


def _retry_llm(fn, retries: int = MAX_LLM_RETRIES):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            print(f"[AGENT 6] LLM call failed (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_err}")


# ── Step 1: HTML Generation via LLM ─────────────────────────────────────

def generate_landing_page_html(
    company_name: str,
    crisis_summary: str,
    historical_lesson: str,
) -> str:
    """Call Gemini to produce a complete HTML/Tailwind crisis landing page."""
    use_llm = llm_pro or llm_flash
    if not use_llm:
        raise RuntimeError("No LLM configured (GOOGLE_API_KEY missing).")

    system_msg = LANDING_PAGE_SYSTEM_PROMPT.format(
        crisis_summary=crisis_summary,
        historical_lesson=historical_lesson,
    )
    user_msg = LANDING_PAGE_USER_PROMPT.format(
        company_name=company_name,
        crisis_summary=crisis_summary,
        historical_lesson=historical_lesson,
    )

    from langchain_core.messages import SystemMessage, HumanMessage

    messages = [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]

    print(f"[AGENT 6] Generating crisis landing page HTML for {company_name}...")
    response = _retry_llm(lambda: use_llm.invoke(messages))
    html = response.content.strip()

    if html.startswith("```"):
        html = html.split("\n", 1)[1] if "\n" in html else html[3:]
        if html.endswith("```"):
            html = html[:-3]
        html = html.strip()

    print(f"[AGENT 6] HTML generated — {len(html)} chars")
    return html


# ── Step 2: Vercel Deployment ────────────────────────────────────────────

def deploy_to_vercel(html_content: str, company_name: str) -> str:
    """Deploy generated HTML to Vercel via the v13/deployments REST API."""
    token = os.getenv("VERCEL_API_TOKEN")
    if not token:
        print("[AGENT 6] VERCEL_API_TOKEN not set — skipping deployment.")
        return "deployment_skipped_no_token"

    project_name = f"pr-crisis-{company_name.lower().replace(' ', '-')}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    payload = {
        "name": project_name,
        "target": "production",
        "files": [
            {
                "file": "index.html",
                "data": html_content,
            }
        ],
        "projectSettings": {
            "framework": None,
        },
    }

    print(f"[AGENT 6] [VERCEL] Deploying {project_name}...")
    try:
        resp = requests.post(
            "https://api.vercel.com/v13/deployments",
            json=payload,
            headers=headers,
            timeout=30,
        )

        if resp.status_code in (200, 201):
            deploy_data = resp.json()
            live_url = f"https://{deploy_data['url']}"
            print(f"[AGENT 6] [VERCEL] Live! {live_url}")
            return live_url
        else:
            print(f"[AGENT 6] [VERCEL] Error {resp.status_code}: {resp.text[:300]}")
            return f"deployment_error_{resp.status_code}"

    except requests.RequestException as e:
        print(f"[AGENT 6] [VERCEL] Network error: {e}")
        return "deployment_error_network"


# ── Step 3: Programmatic Ads Simulation (Mock) ──────────────────────────

def simulate_programmatic_bidding(company_name: str, crisis_summary: str) -> dict:
    """Simulate Google Ads keyword hijacking for the crisis."""
    print("[AGENT 6] [ADS API] Extracting urgent keywords...")
    time.sleep(0.5)

    keywords = [
        (f"Scandal {company_name}", 2.40),
        (f"Refund {company_name}", 1.85),
        (f"{company_name} crisis response", 1.60),
        (f"{company_name} official statement", 0.95),
    ]

    total_bid = 0.0
    acquired = []
    for kw, bid in keywords:
        time.sleep(0.3)
        print(f'[AGENT 6] [ADS API] Bid ${bid:.2f} on "{kw}" -> RANK 1 ACQUIRED')
        total_bid += bid
        acquired.append({"keyword": kw, "bid_usd": bid, "rank": 1})

    time.sleep(0.3)
    print("[AGENT 6] [ADS API] Hostile traffic redirected to official Landing Page.")

    return {
        "keywords_acquired": len(acquired),
        "total_bid_usd": round(total_bid, 2),
        "simulated_budget_eur": 5000.00,
        "details": acquired,
    }


# ── Step 4: Main Node Function ──────────────────────────────────────────

def hijacker_node(state: GraphState) -> dict[str, Any]:
    """
    Agent 6: generates a crisis landing page, deploys it, and simulates
    programmatic ad hijacking. Only fires if severity >= threshold.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    t0 = time.time()

    try:
        return _run_hijacker(state, customer_id, crisis_id, t0)
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[AGENT 6] CRITICAL ERROR after {elapsed:.1f}s: {e}")
        traceback.print_exc()
        return {
            "hijacker_live_url": "",
            "hijacker_html_generated": False,
            "hijacker_deployed": False,
            "hijacker_ads_simulated": False,
            "agent6_api_cost_eur": 0.0,
        }


def _run_hijacker(
    state: GraphState,
    customer_id: str,
    crisis_id: str,
    t0: float,
) -> dict[str, Any]:
    company_name = state.get("company_name", "Unknown")
    severity_score = state.get("severity_score", 0)
    global_lesson = state.get("global_lesson", "No historical lesson available.")
    articles = state.get("articles", [])

    crisis_summary = _build_crisis_summary(articles, company_name)

    print(f"[AGENT 6] Company: {company_name} | Severity: {severity_score}/5")

    if severity_score < SEVERITY_THRESHOLD:
        print(
            f"[AGENT 6] Severity {severity_score} < {SEVERITY_THRESHOLD} — "
            "crisis too minor, skipping narrative hijack."
        )
        return {
            "hijacker_live_url": "",
            "hijacker_html_generated": False,
            "hijacker_deployed": False,
            "hijacker_ads_simulated": False,
            "agent6_api_cost_eur": 0.0,
        }

    # 1) Generate HTML
    html = generate_landing_page_html(company_name, crisis_summary, global_lesson)
    html_ok = bool(html and "<html" in html.lower())

    # 2) Deploy to Vercel
    live_url = ""
    deployed = False
    if html_ok:
        live_url = deploy_to_vercel(html, company_name)
        deployed = live_url.startswith("https://")

    # 3) Simulate Ads
    ads_result = simulate_programmatic_bidding(company_name, crisis_summary)

    api_cost = 0.02 if llm_pro else 0.005

    elapsed = time.time() - t0
    print(f"[AGENT 6] Done in {elapsed:.1f}s")
    print(f"[AGENT 6] HTML: {'OK' if html_ok else 'FAILED'} | "
          f"Deployed: {deployed} | URL: {live_url}")
    print(f"[AGENT 6] Ads: {ads_result['keywords_acquired']} keywords hijacked")

    return {
        "hijacker_live_url": live_url,
        "hijacker_html_generated": html_ok,
        "hijacker_deployed": deployed,
        "hijacker_ads_simulated": True,
        "hijacker_ads_keywords": ads_result["keywords_acquired"],
        "hijacker_ads_budget_eur": ads_result["simulated_budget_eur"],
        "agent6_api_cost_eur": round(api_cost, 4),
    }


def _build_crisis_summary(articles: list[dict], company_name: str) -> str:
    """Build a crisis summary from article summaries for the LLM prompt."""
    if not articles:
        return f"{company_name} is facing a corporate crisis."
    summaries = [a.get("summary", "") for a in articles[:5] if a.get("summary")]
    if not summaries:
        return f"{company_name} is facing a corporate crisis."
    return " ".join(summaries)


# ── Standalone REST entry point ──────────────────────────────────────────

def hijacker_from_data(
    company_name: str,
    articles: list[dict],
    global_lesson: str,
    severity_score: int,
) -> dict[str, Any]:
    """
    Standalone entry point for Agent 6 — called by the REST API.
    Builds a minimal GraphState and delegates to _run_hijacker().
    """
    state: GraphState = {
        "company_name": company_name,
        "articles": articles,
        "global_lesson": global_lesson,
        "severity_score": severity_score,
        "customer_id": "",
        "crisis_id": "",
    }
    t0 = time.time()
    try:
        return _run_hijacker(state, "", "", t0)
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[AGENT 6] CRITICAL ERROR after {elapsed:.1f}s: {e}")
        traceback.print_exc()
        return {
            "hijacker_live_url": "",
            "hijacker_html_generated": False,
            "hijacker_deployed": False,
            "hijacker_ads_simulated": False,
            "agent6_api_cost_eur": 0.0,
        }
