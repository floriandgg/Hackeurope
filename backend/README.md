# Backend — Orchestration des Agents de Communication

Système agentique multi-agents pour la gestion de crise et la communication corporate. Chaque agent joue un rôle spécialisé, orchestré via **LangGraph** en Python.

---

## Architecture du graphe

```
                    ┌─────────────────┐
                    │   INPUT         │
                    │  (nom entreprise)│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT 1       │
                    │   The Watcher   │
                    │   Collecte info │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌─────────────────┐           ┌─────────────────┐
     │   AGENT 2       │           │   AGENT 3       │
     │   Precedents    │           │   The Scorer    │
     │   Situations    │           │   Reach/Churn/  │
     │   similaires    │           │   VaR           │
     └────────┬────────┘           └────────┬────────┘
              │                             │
              └──────────────┬──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT 4       │
                    │   Strategist    │
                    │   Décision +    │
                    │   Report + Posts│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT 5       │
                    │   The CFO       │
                    │   Facture ROI   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   OUTPUT        │
                    │   Décision +    │
                    │   Facture Paid.ai│
                    └─────────────────┘
```

---

## Rôles des agents

### Agent 1 — The Watcher (Collecte)
- **API** : Tavily + Gemini 1.5 Flash
- **Mission** : Scraper le web (Tavily), analyser avec LLM (Authority + Severity), calculer Exposure Score
- **Output** : Top 10 articles avec `title`, `url`, `content`, `authority_score`, `severity_score`, `recency_multiplier`, `exposure_score`
- **Formule** : `Exposure Score = (Authority × Severity) × Recency Multiplier`

### Agent 2 — Precedents (Recherche de cas similaires)
- **API** : Tavily
- **Mission** : Trouver des situations similaires dans d'autres articles/crises
- **Dépendance** : Agent 1 (contexte de la crise)
- **Output** : Articles de référence pour alimenter la stratégie

### Agent 3 — The Scorer (Scoring)
- **LLM** : Gemini
- **Mission** : Calculer 3 indicateurs
  1. **Reach** : Potentiel de propagation
  2. **Churn Risk** : Dangerosité client
  3. **VaR** : Valeur à risque (€)
- **Dépendance** : Agent 1 (articles à scorer)
- **Output** : Scores pour chaque article/crise

### Agent 4 — The Strategist (Décision + Génération)
- **Dépendances** : Agent 2 + Agent 3 (tous deux requis)
- **Mission** :
  - Arbre de décision (VaR → action, Reach → canal, Churn → ton)
  - Générer : report, posts, communiqué presse, email interne
  - Proposer 3 stratégies avec coût, impact, ROI
  - Recommander la stratégie max ROI
- **Output** : Rapport complet + brouillons de communication

### Agent 5 — The CFO (Facturation & ROI)
- **Intégration** : Helicone/LangSmith (traçage API) + Paid.ai (facture)
- **Mission** :
  - Tracer les coûts API des agents 1–4
  - Générer la facture dynamique (ex : 500 € plan de sauvetage)
  - Montrer le ROI massif vs coût réel
- **Output** : Facture, justification, arbitrages, refus d'action

---

## Flux de données (State LangGraph)

Le state partagé entre les nœuds contient :

| Clé | Produit par | Consommé par |
|-----|-------------|--------------|
| `company_name` | Input | Tous |
| `articles` | Agent 1 | Agent 2, 3, 4 |
| `precedents` | Agent 2 | Agent 4 |
| `scores` (Reach, Churn, VaR) | Agent 3 | Agent 4 |
| `strategy_report` | Agent 4 | Agent 5 |
| `billing_data` | Agents 1–4 | Agent 5 |
| `invoice` | Agent 5 | Output |

---

## Arborescence des fichiers

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
│   ├── graph/                    # Orchestration LangGraph
│   │   ├── __init__.py
│   │   ├── workflow.py           # Graphe principal (compilation)
│   │   └── state.py              # State typé
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── agent_1_watcher/      # Collecte + détection
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   ├── agent_2_precedents/   # Cas similaires
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   ├── agent_3_scorer/       # Scoring (Reach, Churn, VaR)
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   ├── agent_4_strategist/   # Décision + report + posts
│   │   │   ├── __init__.py
│   │   │   └── node.py
│   │   └── agent_5_cfo/          # Facture Paid.ai
│   │       ├── __init__.py
│   │       └── node.py
│   │
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── types.py              # Schémas Pydantic
│   │   ├── config.py             # Variables d'environnement
│   │   └── prompts/              # Prompts LLM par agent
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

## Exécution du graphe (conceptuel)

1. **Condition de branchement** : Après Agent 1, déclencher Agent 2 et Agent 3 en **parallèle** (branches indépendantes).
2. **Condition de convergence** : Agent 4 attend que Agent 2 **et** Agent 3 aient terminé.
3. **Ordre final** : Agent 1 → (Agent 2 ∥ Agent 3) → Agent 4 → Agent 5.

---

## Paid.ai — Facturation agentique (Outcome Pricing)

Les agents 2, 3 et 4 émettent **un signal Paid.ai** par business outcome. Chaque signal inclut :
- `human_equivalent_value_eur` : valeur facturée (équivalent humain)
- `api_compute_cost_eur` : coût réel des tokens/API
- `agent_gross_margin_percent` : marge brute (ROI)

### Tester l'Agent 1

```bash
cd backend
pip install -r requirements.txt
# Remplir .env avec TAVILY_API_KEY, GOOGLE_API_KEY

PYTHONPATH=. python -m src.main Tesla
```

### Configuration Paid.ai

1. Créer une clé API sur [app.paid.ai](https://app.paid.ai/agent-integration/api-keys)
2. Définir `PAID_API_KEY` dans `.env` à la racine du projet
3. Produit : `pr-crisis-swarm-001`

### Signaux par agent

| Agent | Event | Facturation |
|-------|-------|-------------|
| Agent 2 | `historical_precedents_extracted` | Variable (cas × 3h × 150€/h) |
| Agent 3 | `risk_assessment_completed` | 500€ + 0,01 % du risque |
| Agent 4 | `crisis_strategy_delivered` | Fixe 2 500€ (livrable premium) |

### GraphState obligatoire

- `customer_id` : external_customer_id Paid.ai (défini par Agent 1)
- `crisis_id` : UUID unique par run (généré par Agent 1)
