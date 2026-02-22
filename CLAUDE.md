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
- **API integration:** `frontend/src/api.ts` calls `POST /api/search`, `POST /api/precedents`, and `POST /api/crisis-response` on the backend (`backend/src/server.py`). Vite dev proxy forwards `/api` to `http://localhost:8000`.

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

### Backend: Agent 3 (The Scorer)

`backend/src/agents/agent_3_scorer/node.py` — Enriches articles with financial risk metrics using Gemini. Calculates estimated reach, churn probability, and value-at-risk (VaR) per article.

**Two entry points:**
- `scorer_node(state: GraphState)` — used in the LangGraph pipeline
- `scorer_from_articles(articles: list[dict])` — standalone function called by the REST API

**Output:** `{ articles (enriched with VaR/reach/churn), total_var_impact, severity_score, agent3_api_cost_eur }`.

### Backend: Agent 4 (The Strategist)

`backend/src/agents/agent_4_strategist/node.py` — Generates crisis response strategies with ROI analysis and communication drafts using Gemini. Takes enriched articles (from Agent 3), historical precedents (from Agent 2), and financial metrics to produce 3 named strategies (Offensive, Diplomate, Silence).

**Two entry points:**
- `strategist_node(state: GraphState)` — used in the LangGraph pipeline (via `_run_strategist()`)
- `strategist_from_data(company_name, articles, precedents, global_lesson, confidence, total_var_impact, severity_score)` — standalone function called by the REST API

**`CrisisStrategy` fields** (`backend/src/shared/types.py`): `name`, `description`, `tone`, `channels`, `key_actions`, `estimated_cost_eur`, `estimated_impact`, `roi_score`.

**`Agent4Output` fields:** `alert_level` (IGNORE/SOFT/MEDIUM/CRITICAL), `alert_reasoning`, `recommended_action`, `strategies[]`, `recommended_strategy`, `recommendation_reasoning`, `press_release`, `internal_email`, `social_post`, `legal_notice_draft`, `decision_summary`.

**Combined API endpoint:** `POST /api/crisis-response` accepts `{ company_name, topic_name, topic_summary, articles[] }` and orchestrates Agent 3 → Agent 2 → Agent 4 → Agent 5 sequentially. Returns `{ strategy_report, recommended_strategy_name, precedents[], global_lesson, confidence, invoice }`.

### Backend: Agent 5 (The CFO)

`backend/src/agents/agent_5_cfo/node.py` — Purely computational agent (no LLM). Aggregates API costs from Agents 2–4, calculates human-equivalent consulting values, builds a structured invoice with ROI analysis, and determines action refusals for trivial crises.

**Two entry points:**
- `cfo_node(state: GraphState)` — used in the LangGraph pipeline
- `cfo_from_data(agent2_api_cost, agent3_api_cost, agent4_api_cost, cases_count, total_var_impact, alert_level)` — standalone function called by the REST API

**Billing formulas** (same as `backend/src/utils/paid_helpers.py`):
- Agent 2: `cases_count × 3h × €150/h` (consulting hours saved)
- Agent 3: `€500 + 0.01% of total_var_impact` (risk assessment fee)
- Agent 4: Fixed `€2,500` (crisis management plan)

**`InvoiceLineItem` fields** (`backend/src/shared/types.py`): `agent`, `event`, `human_equivalent_value_eur`, `api_compute_cost_eur`, `gross_margin_percent`, `detail`.

**`Agent5Output` fields:** `line_items[]`, `total_human_equivalent_eur`, `total_api_cost_eur`, `total_gross_margin_percent`, `roi_multiplier`, `invoice_summary`, `trade_off_reasoning`, `action_refused`, `refusal_reason`.

**Action refusal:** When `alert_level` is IGNORE, Agent 5 returns `action_refused: true` with empty line items and a refusal reason. The total API cost is still tracked.

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

**Agent 4:** `transformStrategyReport()` maps backend `Agent4Output` → frontend `StrategyData`:
- `strategies[]` → `FrontendStrategy[]` (name, description, tone, channels, keyActions, estimatedCostEur, estimatedImpact, roiScore)
- `recommended_strategy` → `recommendedStrategy`
- `press_release`, `internal_email`, `social_post`, `legal_notice_draft` → `drafts` object
- Defensive guards: throws if `strategy_report` or `strategies` is empty/undefined
- `fetchCrisisResponse()` returns `strategyData`, `precedentsData`, and `invoiceData` from the single combined endpoint

**Agent 5:** `transformInvoice()` maps backend `Agent5Output` → frontend `InvoiceData`:
- `line_items[]` → `InvoiceLineItem[]` (agent, event, humanEquivalentValueEur, apiComputeCostEur, grossMarginPercent, detail)
- Snake_case → camelCase for all scalar fields
- `action_refused` / `refusal_reason` carried through for UI empty state

**Debug mode:** Add `?debug` to the frontend URL (e.g. `http://localhost:5173/?debug`) to bypass the backend and use mock data. Agent 1 mock delay: 2.5s, Agent 2+3+4+5 combined mock delay: 5s. Defined in `api.ts`.

**Demo data:** Pre-cached API responses for 3 showcase companies (OpenAI, Tesla, Apple) stored in `frontend/src/data/raw/` as JSON files. Captured by `scripts/capture-demo-data.py` (requires backend running on localhost:8000, resume-friendly — skips existing files). `frontend/src/data/demoData.ts` imports the raw JSON at build time and transforms it using the same `transform*` functions as the live API path. Each company has a `*-search.json` (Agent 1 output) and `*-topic-N-crisis.json` files (Agent 2+3+4+5 combined output per topic). Currently: OpenAI (2 topics), Tesla (3 topics), Apple (3 topics).

### Frontend pages

**User flow:** Landing page (company name input) → bubble transition → article discovery page (agent timeline + topic cards) → user picks a topic → expanded view with articles → "Respond to Topic" → strategy page (3 response strategies) → "See Why" → precedents page (historical case timeline) / "View Drafts" → draft viewer page (channel-specific response drafts) / "Cost Breakdown" → invoice page (ROI analysis, agency vs AI cost comparison).

**App.tsx:** Manages view state (`landing` | `discovery` | `strategy` | `precedents` | `drafts` | `invoice`) and a FLIP-style bubble transition between landing and discovery. On search submit, fires `searchCompany()` API call alongside the transition. Stores `topicGroups`, `isLoading`, `searchError` state (Agent 1), `precedentsData`, `precedentsLoading`, `precedentsError` state (Agent 2), `strategyData`, `strategyLoading`, `strategyError` state (Agent 4), and `invoiceData` state (Agent 5). `selectedTopic` is a full `TopicGroup` (not just name/summary) so downstream agents can access the topic's articles. `onRespondToTopic` calls `fetchCrisisResponse()` which runs Agent 3+2+4+5 via the combined `/api/crisis-response` endpoint — sets `strategyData`, `precedentsData`, and `invoiceData` from one response. `onSeeWhy` just navigates to precedents (data already loaded, no separate API call). `onViewDrafts` navigates to drafts with strategy index. `onViewInvoice` navigates to invoice (data already loaded). `onBack` from precedents, drafts, or invoice returns to strategy.

**Landing page** (`LandingPage.tsx`): Hero with textarea input, project showcase cards at the bottom with 3D tilt-on-hover effect (`TiltCard` component). Two Spline-ready containers are in place (background scene at `z-[1]` and a secondary slot between input and cards) for adding 3D models later. Desktop uses a fanned card layout; mobile uses a horizontal scroll.

**Article discovery page** (`ArticleDiscoveryPage.tsx`): Split-view layout — left sidebar shows an animated agent activity timeline (6 steps with progressive delays ~1s→20s while loading, final step completes when data arrives), right panel displays topic cards in an overlapping stack. Topics fan out on hover. Clicking a topic triggers a FLIP card-expand animation into a detail view showing urgency score, summary, a "Respond to Topic" button, and a stacked row of individual article cards. Article cards are clickable `<a>` links that open the source URL in a new tab. Data comes from Agent 1 via `topicGroups` prop (variable number of groups, 1–5). Articles have criticality scores (1–10) with color-coded badges (red ≥8, amber ≥5, gray below). Error and empty states handled. The "Respond to Topic" button calls `onRespondToTopic` with the full `TopicGroup` object.

**Strategy page** (`StrategyPage.tsx`): **Integrated with Agent 3+4 (real data).** Split-view layout matching the article discovery and precedents pages. Left sidebar shows an animated agent activity timeline (6 steps: steps 1-2 = Agent 3 financial scoring, steps 3-4 = Agent 2 precedent search, steps 5-6 = Agent 4 strategy generation). Right panel displays dynamic strategy cards from `strategyData.strategies` (typically 3: Offensive/red, Diplomate/green, Silence/gray). Each card shows description (line-clamped), tone badge, cost + ROI metrics, key actions (max 3 shown with "+N more"), estimated impact, and a "View Drafts" button. Recommended strategy gets a badge. Alert level badge at top (CRITICAL/MEDIUM/SOFT/IGNORE with color coding). Decision summary card below cards, then two buttons: "See Why" (navigates to precedents) and "Cost Breakdown" (navigates to invoice). Two-useEffect loading pattern. `StrategyTiltCard` uses inline `perspective(800px)` in the transform string (not `transformStyle: preserve-3d`) to avoid 3D stacking context issues with `overflow-y-auto` hit-testing. Props: `companyName`, `topic`, `strategyData`, `isLoading`, `searchError`, `onBack`, `onViewDrafts`, `onSeeWhy`, `onViewInvoice`.

**Precedents page** (`PrecedentsPage.tsx`): **Integrated with Agent 2 (real data).** Split-view layout matching the article discovery page — left sidebar shows an animated agent activity timeline (6 steps with progressive delays ~1s→28s while loading, final step completes when data arrives), right panel displays a vertical timeline of historical precedent cases. Each case card shows company/year, crisis description, type badge, strategy used, outcome badge (green "Recovered" / red "Damaged" with outcome detail), a blockquote-style lesson, and clickable article cards (when source URL exists). Props: `precedentsData`, `isLoading`, `searchError` from App.tsx. Two-useEffect loading pattern: Effect 1 animates steps 0–4 while loading; Effect 2 completes step 5, stagger-reveals cases, and shows summary card when data arrives. Dynamic case count (not hardcoded). Summary card shows confidence level + case count. "Key Insight" card displays `globalLesson` from Agent 2. Error and empty states with back buttons.

**Draft viewer page** (`DraftViewerPage.tsx`): **Integrated with Agent 4 (real data).** Accessible via "View Drafts" on the strategy page. Shows an interactive horizontal crisis timeline at the top (4 nodes: NOW → +1h → +4h → +24h). Below the timeline, horizontal channel tabs (Press Release, Internal Email, Social Post, Legal Notice — 4 channels matching Agent 4 output) sit above a draft text viewer that displays AI-generated content from `strategyData.drafts`. Legal Notice tab shows "Not applicable at this alert level" when empty (non-CRITICAL alerts). Strategy name and color in header derived from `strategyData`. Props: `companyName`, `topic`, `strategyIndex`, `strategyData`, `onBack`.

**Invoice page** (`InvoicePage.tsx`): **Integrated with Agent 5 (real data).** Accessible via "Cost Breakdown" on the strategy page. Dashboard-style layout with left sidebar agent timeline matching other pages. Left sidebar shows a fast agent timeline (6 steps recapping all agents, auto-animating at 200ms per step since data is pre-loaded). Right panel is a dashboard grid: (1) left-aligned header with company/topic context and "Cost Analysis" title, (2) 3-column KPI strip (Agency Cost with strikethrough, AI Cost in royal, ROI multiplier with animated count-up — ease-out cubic, 1.8s) each with top accent gradient bar, (3) 3-column agent cost card grid (Historical Strategist/royal, Risk Analyst/amber, Executive Strategist/emerald) — each card has a colored top accent bar, agent icon in tinted square, name + billing formula detail, animated savings progress bar with percentage, and agency-vs-AI cost comparison at bottom, (4) totals bar with dual horizontal comparison bars (agency full-width gray vs AI tiny royal) and a "You Saved" summary panel showing total savings and gross margin, (5) trade-off reasoning callout card with icon. Helper components: `AgentCostCard` (individual agent card with `useAnimatedWidth` hook for savings bar), `CostBar` (horizontal comparison bar with animated width). Action refused state: when `actionRefused` is true (IGNORE alert level), shows a centered "No Billable Action" empty state with refusal reason and monitoring cost. Summary card in sidebar shows ROI multiplier + agent count. Props: `companyName`, `topic`, `invoiceData`, `onBack`.

**Integration status:**
- Landing → Discovery: **integrated** with Agent 1 (real data)
- Discovery → Strategy: **integrated** with Agent 3 + Agent 4 (real data via combined `/api/crisis-response` endpoint)
- Strategy → Precedents: **integrated** with Agent 2 (real data, loaded alongside strategy from same endpoint)
- Strategy → Drafts: **integrated** with Agent 4 (real AI-generated drafts)
- Strategy → Invoice: **integrated** with Agent 5 (real data, loaded alongside strategy from same endpoint)
- Mock data still used for: crisis timeline node descriptions

**Pipeline phases (remaining, not yet built):**
1. CrisisBrief — initial crisis analysis

## Design

- Light theme with muted blue-gray palette (royal `#2b3a8f`, steel `#5a7d95`, storm `#6d8a9e`, mist `#e8eaf0`, periwinkle `#c8cce8`)
- Fonts: Instrument Serif (display) + Outfit (body) via Google Fonts
- Smooth staggered entrance animations, cursor-tracking card tilt
- Should look like a polished product, not a hackathon prototype
