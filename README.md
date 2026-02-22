# HarborAI

**AI-powered crisis communications in seconds, not days.**

Enter a company name. Our 5-agent AI pipeline scans the web for negative press, quantifies financial risk, finds historical precedents, generates three competing response strategies with full communication drafts, and shows you exactly how much you just saved versus a human consulting firm.

> Built for [HackEurope 2026](https://hackeurope.dev) — the AI hackathon.

---

## How It Works

```
         Company Name
              │
              ▼
    ┌───────────────────┐
    │   The Watcher      │  Tavily + Jina + Gemini
    │   Scan & Score     │  → articles grouped by crisis topic
    └─────────┬─────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐    ┌──────────┐
│ Precedent│    │  Scorer  │   ← run in parallel
│ Strategist│   │  (VaR)  │
└────┬─────┘    └────┬─────┘
     └────────┬────────┘
              ▼
    ┌───────────────────┐
    │   The Strategist   │  3 strategies + drafts
    └─────────┬─────────┘
              ▼
    ┌───────────────────┐
    │   The CFO          │  Invoice + ROI analysis
    └───────────────────┘
```

| Agent | Role | Key Tech |
|-------|------|----------|
| **Agent 1 — The Watcher** | Scrapes negative press, scores exposure risk, groups by crisis topic | Tavily, Jina Reader, Gemini Flash |
| **Agent 2 — Historical Strategist** | Finds real-world precedents of similar crises and their outcomes | Gemini Pro + Google Search Grounding |
| **Agent 3 — The Scorer** | Translates media signals into financial metrics (reach, churn, VaR) | Gemini Flash |
| **Agent 4 — The Strategist** | Generates 3 named strategies (Offensive, Diplomate, Silence) with drafts | Gemini Flash |
| **Agent 5 — The CFO** | Builds transparent invoice: AI cost vs. human consulting equivalent | Pure computation (no LLM) |

---

## User Flow

1. **Landing** — Type a company name (or pick a demo: OpenAI, Tesla, Apple)
2. **Discovery** — Browse crisis topics with exposure scores, read article summaries
3. **Strategy** — Three response strategies with alert level, ROI scores, and key actions
4. **Precedents** — Historical timeline of similar crises and how companies handled them
5. **Drafts** — AI-generated press release, internal email, social post, and legal notice
6. **Invoice** — Full cost breakdown showing agency vs. AI savings with ROI multiplier

---

## Tech Stack

**Backend:** Python 3.11 &middot; FastAPI &middot; LangGraph &middot; LangChain &middot; Gemini 2.5 Flash / Pro &middot; Tavily &middot; Jina Reader &middot; Pydantic

**Frontend:** React 18 &middot; TypeScript &middot; Vite &middot; Tailwind CSS v3 &middot; Instrument Serif + Outfit fonts

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- API keys: [Google AI (Gemini)](https://aistudio.google.com/apikey), [Tavily](https://tavily.com), [Jina](https://jina.ai)

### 1. Clone & install

```bash
git clone https://github.com/floriandgg/Hackeurope.git
cd Hackeurope
```

```bash
# Backend
cd backend
pip install -r requirements.txt
```

```bash
# Frontend
cd frontend
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
TAVILY_API_KEY=tvly-...
GOOGLE_API_KEY=AIza...
GOOGLE_API_KEY1=AIza...   # second key for parallel agent execution
JINA_API_KEY=jina_...
```

### 3. Run

```bash
# Terminal 1 — Backend (from backend/)
cd backend
PYTHONPATH=. uvicorn src.server:app --reload --port 8000

# Terminal 2 — Frontend (from frontend/)
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and enter a company name.

### Demo Mode

Add `?debug` to the URL ([http://localhost:5173/?debug](http://localhost:5173/?debug)) to use pre-cached data for OpenAI, Tesla, and Apple — no backend or API keys required.

---

## Architecture Highlights

**Parallel execution.** Agents 2 and 3 are independent and run simultaneously. A dual API key strategy (`GOOGLE_API_KEY` / `GOOGLE_API_KEY1`) gives each parallel branch its own Gemini quota to avoid rate limits.

**Dual entry points.** Every agent exposes both a LangGraph node function (`*_node(state)`) and a standalone REST-callable function. This allowed independent development and flexible composition.

**Financial modeling.** Agent 3 uses a conservative VaR model with deduplication weights (100% / 20% / 10% for subsequent articles on the same story) to prevent double-counting multi-outlet coverage.

**Hallucination guard.** Agent 2 runs a verification step where Gemini Flash cross-checks Gemini Pro's extracted precedents against their cited source URLs, filtering fabricated references.

**Outcome-based billing.** Agent 5 compares real API costs against human consulting equivalents. For trivial crises (`alert_level = IGNORE`), it refuses to bill — because running the full pipeline isn't worth the client's money.

**Log-normalized scores.** Unbounded exposure scores are mapped to a 1–10 criticality scale via `clamp(1, round(2.2 × ln(score)), 10)`, preserving meaningful differences without outlier domination.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/search` | Run Agent 1 — scan for negative press |
| `POST` | `/api/search/stream` | Same as above with SSE progress events |
| `POST` | `/api/precedents` | Run Agent 2 — find historical precedents |
| `POST` | `/api/crisis-response` | Combined pipeline: Agents 2+3 (parallel) → 4 → 5 |

---

## Project Structure

```
Hackeurope/
├── backend/
│   └── src/
│       ├── agents/
│       │   ├── agent_1_watcher/       # Web scanning + exposure scoring
│       │   ├── agent_2_precedents/    # Historical precedent research
│       │   ├── agent_3_scorer/        # Financial risk modeling (VaR)
│       │   ├── agent_4_strategist/    # Strategy generation + drafts
│       │   └── agent_5_cfo/           # Invoice + ROI computation
│       ├── clients/                   # Tavily, Jina, Gemini API clients
│       ├── graph/                     # LangGraph state + workflow
│       ├── shared/                    # Pydantic types, config, prompts
│       └── server.py                  # FastAPI REST API
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── LandingPage.tsx        # Hero + demo showcase cards
│       │   ├── ArticleDiscoveryPage.tsx # Agent timeline + topic cards
│       │   ├── StrategyPage.tsx       # 3 strategy cards + alert level
│       │   ├── PrecedentsPage.tsx     # Historical case timeline
│       │   ├── DraftViewerPage.tsx    # Crisis timeline + channel tabs
│       │   └── InvoicePage.tsx        # ROI dashboard + cost breakdown
│       ├── data/                      # Pre-cached demo data (build-time)
│       ├── api.ts                     # Backend integration + transforms
│       └── App.tsx                    # View routing + state management
│
└── scripts/
    └── capture-demo-data.py           # Capture live API responses for demos
```

---

## Team

Built at HackEurope 2026.

---

## License

[MIT](LICENSE)
