# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Crisis PR Agent — an AI-powered crisis communications tool. The user enters a company name on the landing page. AI agents scrape for the most recent negative press, display the articles, and let the user select which crisis to respond to. From there, a multi-phase pipeline generates PR strategy, talking points, and response drafts.

## Tech Stack

- **Frontend:** React 18 via Vite, TypeScript, Tailwind CSS v3
- **Backend:** Python 3, FastAPI + Uvicorn, LangGraph, LangChain, Gemini 2.5 Flash, Tavily (news search), Jina Reader (content extraction)

## Commands

Frontend (run from `frontend/`):

- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **Type check:** `npx tsc --noEmit`

Backend (run from `backend/`):

- **API server:** `PYTHONPATH=. uvicorn src.server:app --reload --port 8000`
- **CLI test Agent 1:** `PYTHONPATH=. python -m src.main Tesla`
- **CLI test Agent 1+3:** `PYTHONPATH=. python -m src.main Tesla --agent3`

## Architecture

- **Frontend:** `frontend/src/` — React/Vite SPA. The article discovery page is integrated with the backend via REST; other pages still use mock data.
- **Backend:** `backend/` — Python + LangGraph, 5 agents (Watcher, Precedents, Scorer, Strategist, CFO). See `backend/README.md` for orchestration.
- **API integration:** `frontend/src/api.ts` calls `POST /api/search` and `POST /api/precedents` on the backend (`backend/src/server.py`). Vite dev proxy forwards `/api` to `http://localhost:8000`.

### Backend: Agent 1 (The Watcher)

`backend/src/agents/agent_1_watcher/node.py` — `watcher_node(state)` is the first agent. Input: `{ company_name }`. Steps: Tavily search (up to 10 articles) → Jina Reader content extraction → Gemini structured analysis (summary, subject, authority 1–5, severity 1–5, sentiment) → exposure score calculation → group by subject. Output: `{ customer_id, crisis_id, articles (flat), subjects (grouped) }`. Articles are sorted by exposure score descending; subjects are sorted by total group exposure.

**Subject categories (fixed):** `security_fraud`, `legal_compliance`, `ethics_management`, `product_bug`, `customer_service`. Display names in `SUBJECT_DISPLAY_NAMES` (`backend/src/shared/types.py`).

**Exposure score formula:** `(authority × severity) × risk_multiplier × recency_multiplier × sentiment_weight`. Risk multipliers and sentiment weights defined in `backend/src/shared/types.py`.

### Backend: Agent 2 (Historical PR Strategist)

`backend/src/agents/agent_2_precedents/node.py` — 3-phase pipeline using Gemini with Google Search Grounding:
- **Step 2.1:** Build `Agent1Output` from topic data (company, crisis summary, articles)
- **Step 2.2:** 3 sequential grounded Gemini Pro searches (similar crises → strategies used → measurable outcomes)
- **Step 2.3:** Gemini Pro extracts structured `HistoricalCrisis` cases, Gemini Flash verifies against sources

**Two entry points:**
- `precedents_node(state: GraphState)` — used in the LangGraph pipeline, reads all articles from state
- `precedents_node_from_topic(company_name, topic_name, topic_summary, articles)` — standalone function called by the REST API, takes only the user-selected topic's articles

**`HistoricalCrisis` fields:** `company`, `year`, `crisis_summary`, `crisis_title`, `crisis_type`, `strategy_adopted`, `outcome`, `success_score` (1–10), `lesson`, `source_url`. Output: `Agent2Output` with `past_cases`, `global_lesson`, `confidence` (high/medium/low).

**API endpoint:** `POST /api/precedents` accepts `{ company_name, topic_name, topic_summary, articles[] }` and returns `{ precedents[], global_lesson, confidence }`.

### Frontend–Backend data transformation

**Agent 1:** `frontend/src/api.ts` transforms backend subjects into frontend `TopicGroup[]`:
- `subject.title` → `TopicGroup.name`
- Publisher extracted from article URL domain (25+ known mappings)
- `exposure_score` → `criticality` (1–10) via log normalization: `clamp(1, round(2.2 × ln(score)), 10)`
- `pub_date` ISO string → formatted date ("Feb 19, 2026")
- `url` passed through for clickable article links
- `subject` and `severity_score` carried through on `Article` for Agent 2

**Agent 2:** `transformPrecedents()` maps backend `HistoricalCrisis` → frontend `PrecedentCase`:
- `crisis_title` → `crisis` (fallback: truncate `crisis_summary`)
- `crisis_type` → `crisisType` (fallback: "Corporate Crisis")
- `success_score >= 6` → `outcome: 'positive'`, else `'negative'`
- `outcome` text → `outcomeLabel`
- Single `source_url` → 1-element `articles[]` array with publisher extracted from URL

**Debug mode:** Add `?debug` to the frontend URL (e.g. `http://localhost:5173/?debug`) to bypass the backend and use mock data. Agent 1 mock delay: 2.5s, Agent 2 mock delay: 4s. Defined in `api.ts`.

### Frontend pages

**User flow:** Landing page (company name input) → bubble transition → article discovery page (agent timeline + topic cards) → user picks a topic → expanded view with articles → "Respond to Topic" → strategy page (3 response strategies) → "See Why" → precedents page (historical case timeline) / "View Drafts" → draft viewer page (channel-specific response drafts + tone analysis).

**App.tsx:** Manages view state (`landing` | `discovery` | `strategy` | `precedents` | `drafts`) and a FLIP-style bubble transition between landing and discovery. On search submit, fires `searchCompany()` API call alongside the transition. Stores `topicGroups`, `isLoading`, `searchError` state (Agent 1) and `precedentsData`, `precedentsLoading`, `precedentsError` state (Agent 2). `selectedTopic` is a full `TopicGroup` (not just name/summary) so Agent 2 can access the topic's articles. `onRespondToTopic` from the discovery page passes the full `TopicGroup` and navigates to strategy. `onSeeWhy` triggers `fetchPrecedents()` and navigates to precedents. `onViewDrafts` navigates to drafts with strategy index. `onBack` from precedents or drafts returns to strategy.

**Landing page** (`LandingPage.tsx`): Hero with textarea input, project showcase cards at the bottom with 3D tilt-on-hover effect (`TiltCard` component). Two Spline-ready containers are in place (background scene at `z-[1]` and a secondary slot between input and cards) for adding 3D models later. Desktop uses a fanned card layout; mobile uses a horizontal scroll.

**Article discovery page** (`ArticleDiscoveryPage.tsx`): Split-view layout — left sidebar shows an animated agent activity timeline (6 steps with progressive delays ~1s→20s while loading, final step completes when data arrives), right panel displays topic cards in an overlapping stack. Topics fan out on hover. Clicking a topic triggers a FLIP card-expand animation into a detail view showing urgency score, summary, a "Respond to Topic" button, and a stacked row of individual article cards. Article cards are clickable `<a>` links that open the source URL in a new tab. Data comes from Agent 1 via `topicGroups` prop (variable number of groups, 1–5). Articles have criticality scores (1–10) with color-coded badges (red ≥8, amber ≥5, gray below). Error and empty states handled. The "Respond to Topic" button calls `onRespondToTopic` with the full `TopicGroup` object.

**Strategy page** (`StrategyPage.tsx`): Displays 3 predefined response strategies — "Own It" (green, low risk), "Reframe" (amber, medium risk), "Hold the Line" (red, very high risk). Each card shows description, risk level, trust recovery speed, and best-for scenario. "Own It" is marked as recommended. Cards have tilt-on-hover effect. A "View Drafts →" button on each card calls `onViewDrafts(strategyIndex)` to navigate to the drafts page. A "See Why" button below the cards navigates to the precedents page via `onSeeWhy`.

**Precedents page** (`PrecedentsPage.tsx`): **Integrated with Agent 2 (real data).** Split-view layout matching the article discovery page — left sidebar shows an animated agent activity timeline (6 steps with progressive delays ~1s→28s while loading, final step completes when data arrives), right panel displays a vertical timeline of historical precedent cases. Each case card shows company/year, crisis description, type badge, strategy used, outcome badge (green "Recovered" / red "Damaged" with outcome detail), a blockquote-style lesson, and clickable article cards (when source URL exists). Props: `precedentsData`, `isLoading`, `searchError` from App.tsx. Two-useEffect loading pattern: Effect 1 animates steps 0–4 while loading; Effect 2 completes step 5, stagger-reveals cases, and shows summary card when data arrives. Dynamic case count (not hardcoded). Summary card shows confidence level + case count. "Key Insight" card displays `globalLesson` from Agent 2. Error and empty states with back buttons.

**Draft viewer page** (`DraftViewerPage.tsx`): Accessible via "View Drafts" on the strategy page. Shows an interactive horizontal crisis timeline at the top (5 nodes: Crisis Detected → Analysis → Strategy → Drafts Ready → Distribution). Below the timeline, horizontal channel tabs (Press Release, Twitter/X, Internal Memo, Stakeholder Email, Media Q&A) sit above a draft text viewer that displays strategy-aware mock content — each of the 3 strategies generates different tone/content for all 5 channels. A full-width tone analysis panel at the bottom shows 5 sentiment metrics (Empathy, Accountability, Authority, Urgency, Reassurance) as animated progress bars color-coded by intensity. Props: `companyName`, `topic`, `strategyIndex`, `onBack`.

**Integration status:**
- Landing → Discovery: **integrated** with Agent 1 (real data)
- Discovery → Strategy → Precedents: **integrated** with Agent 2 (real data)
- Strategy, Drafts pages: **still mock data** — ready for Agents 3, 4 integration

**Pipeline phases (remaining, not yet built):**
1. CrisisBrief — initial crisis analysis
2. ValueDashboard — ROI comparison (agency vs AI cost)

## Design

- Light theme with muted blue-gray palette (royal `#2b3a8f`, steel `#5a7d95`, storm `#6d8a9e`, mist `#e8eaf0`, periwinkle `#c8cce8`)
- Fonts: Instrument Serif (display) + Outfit (body) via Google Fonts
- Smooth staggered entrance animations, cursor-tracking card tilt
- Should look like a polished product, not a hackathon prototype
