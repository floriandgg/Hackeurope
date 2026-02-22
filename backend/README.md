# Backend — Communication Agents Orchestration

Multi-agent system for crisis management and corporate communication. Each agent has a specialized role, orchestrated via **LangGraph** in Python.

---

## Graph Architecture

```
                    ┌─────────────────┐
                    │   INPUT         │
                    │  (company name) │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT 1       │
                    │   The Watcher   │
                    │   Collect info  │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌─────────────────┐           ┌─────────────────┐
     │   AGENT 2       │           │   AGENT 3       │
     │   Precedents    │           │   The Scorer    │
     │   Similar cases │           │   Reach/Churn/  │
     │                 │           │   VaR           │
     └────────┬────────┘           └────────┬────────┘
              │                             │
              └──────────────┬──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT 4       │
                    │   Strategist    │
                    │   Decision +    │
                    │   Report + Posts│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT 5       │
                    │   The CFO       │
                    │   Invoice ROI   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   OUTPUT        │
                    │   Decision +    │
                    │   Paid.ai Invoice│
                    └─────────────────┘
```

---

## Agent Roles

### Agent 1 — The Watcher (Collection)
- **API**: Tavily + Gemini 1.5 Flash
- **Mission**: Scrape the web (Tavily), analyze with LLM (Authority + Severity + Subject), compute Exposure Score, group by subject
- **Output**:
  - `articles`: Flat list for Agents 2, 3 (title, summary, url, content, pub_date, author, subject, authority_score, severity_score, recency_multiplier, exposure_score)
  - `subjects`: Grouped for frontend — per subject: `subject`, `title` (display name), `summary`, `article_count`, `articles` (full article objects for click)
- **Formula**: `Exposure Score = (Authority × Severity) × Recency Multiplier`

### Agent 2 — Precedents (Similar Case Search)
- **API**: Tavily
- **Mission**: Find similar situations in other articles/crises
- **Dependency**: Agent 1 (crisis context)
- **Output**: Reference articles to feed the strategy

### Agent 3 — The Scorer (Risk Analyst)
- **LLM**: Gemini (topic + virality classification)
- **Mission**: Transform Agent 1 scores into financial metrics
  1. **Reach**: `(Authority × 20 000) × (Severity / 2) × ViralCoefficient`
  2. **Churn Risk %**: `(Severity / 100) × TopicWeight`
  3. **VaR**: `(Reach × CAC) + (ChurnRisk × TOTAL_CLIENTS × ARR)`
- **Dependency**: Agent 1 (articles with authority_score, severity_score)
- **Output**: Enriched articles (reach_estimate, churn_risk_percent, value_at_risk) + total_var_impact

### Agent 4 — The Strategist (Decision + Generation)
- **Dependencies**: Agent 2 + Agent 3 (both required)
- **Mission**:
  - Decision tree (VaR → action, Reach → channel, Churn → tone)
  - Generate: report, posts, press release, internal email
  - Propose 3 strategies with cost, impact, ROI
  - Recommend max ROI strategy
- **Output**: Full report + communication drafts

### Agent 5 — The CFO (Billing & ROI)
- **Integration**: Helicone/LangSmith (API tracking) + Paid.ai (invoice)
- **Mission**:
  - Track API costs for agents 1–4
  - Generate dynamic invoice (e.g. €500 crisis plan)
  - Show massive ROI vs actual cost
- **Output**: Invoice, justification, trade-offs, action refusals

---

## Data Flow (State LangGraph)

Shared state between nodes:

| Key | Produced by | Consumed by |
|-----|-------------|-------------|
| `company_name` | Input | All |
| `articles` | Agent 1 | Agents 2, 3, 4 |
| `precedents` | Agent 2 | Agent 4 |
| `scores` (Reach, Churn, VaR) | Agent 3 | Agent 4 |
| `strategy_report` | Agent 4 | Agent 5 |
| `billing_data` | Agents 1–4 | Agent 5 |
| `invoice` | Agent 5 | Output |

---

## File Structure

```
backend/
├── README.md
├── requirements.txt
├── pyproject.toml
│
├── src/
│   ├── __init__.py
│   ├── main.py
│   │
│   ├── graph/                    # LangGraph orchestration
│   │   ├── __init__.py
│   │   ├── workflow.py           # Main graph (compilation)
│   │   └── state.py              # Typed state
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── agent_1_watcher/      # Collection + detection
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   ├── agent_2_precedents/   # Similar cases
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   ├── agent_3_scorer/       # Scoring (Reach, Churn, VaR)
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   ├── agent_4_strategist/   # Decision + report + posts
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   └── agent_5_cfo/          # Paid.ai invoice
│   │       ├── __init__.py
│   │       └── node.py
│   │
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── types.py              # Pydantic schemas
│   │   ├── config.py             # Environment variables
│   │   └── prompts/              # LLM prompts per agent
│   │       ├── __init__.py
│   │       ├── severity.py
│   │       ├── viral_coef.py
│   │       └── ...
│   │
│   └── clients/
│       ├── __init__.py
│       ├── tavily_client.py      # Tavily API
│       └── llm_client.py         # Gemini / Claude
│
└── tests/
    ├── __init__.py
    └── ...
```

---

## Graph Execution (conceptual)

1. **Branch condition**: After Agent 1, trigger Agents 2 and 3 in **parallel** (independent branches).
2. **Convergence condition**: Agent 4 waits for both Agent 2 **and** Agent 3 to finish.
3. **Final order**: Agent 1 → (Agent 2 ∥ Agent 3) → Agent 4 → Agent 5.

---

## Paid.ai — Agentic Billing (Outcome Pricing)

Agents 2, 3 and 4 emit **one Paid.ai signal** per business outcome. Each signal includes:
- `human_equivalent_value_eur`: invoiced value (human equivalent)
- `api_compute_cost_eur`: actual token/API cost
- `agent_gross_margin_percent`: gross margin (ROI)

### Test Agent 1

```bash
cd backend
pip install -r requirements.txt
# Fill .env with TAVILY_API_KEY, GOOGLE_API_KEY

PYTHONPATH=. python -m src.main Tesla
```

### Paid.ai Configuration

1. Create an API key at [app.paid.ai](https://app.paid.ai/agent-integration/api-keys)
2. Set `PAID_API_KEY` in `.env` at project root
3. Product: `pr-crisis-swarm-001`

### Signals per agent

| Agent | Event | Billing |
|-------|-------|---------|
| Agent 2 | `historical_precedents_extracted` | Variable (cases × 3h × €150/h) |
| Agent 3 | `risk_assessment_completed` | €500 + 0.01% of risk |
| Agent 4 | `crisis_strategy_delivered` | Fixed €2,500 (premium deliverable) |

### Required GraphState

- `customer_id`: Paid.ai external_customer_id (set by Agent 1)
- `crisis_id`: Unique UUID per run (generated by Agent 1)
