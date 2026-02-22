"""
Shared Pydantic schemas (Article, Agent 1 scores, Agent 2, etc.).
"""
from typing import List
from pydantic import BaseModel, Field, field_validator


# --- Agent 1: Gemini structured output for article scoring ---

SUBJECT_KEYS = (
    "security_fraud",
    "legal_compliance",
    "ethics_management",
    "labor_relations",
    "financial_performance",
    "operational_incident",
    "product_bug",
    "customer_service",
)

class ParagraphDecisions(BaseModel):
    """LLM output: one boolean per paragraph — true if it belongs to the article."""
    decisions: List[bool] = Field(description="Exactly one boolean per paragraph, in order")


SUBJECT_DISPLAY_NAMES = {
    "security_fraud": "Security & Fraud",
    "legal_compliance": "Legal & Compliance",
    "ethics_management": "Ethics & Management",
    "labor_relations": "Labor & Workforce",
    "financial_performance": "Financial & Markets",
    "operational_incident": "Operations & Incidents",
    "product_bug": "Product & Technical",
    "customer_service": "Customer Service",
}

# Risk multipliers by subject (governance/reputation crises weigh more)
SUBJECT_RISK_MULTIPLIERS = {
    "security_fraud": 1.8,
    "legal_compliance": 1.5,
    "ethics_management": 1.8,
    "labor_relations": 1.6,
    "financial_performance": 1.4,
    "operational_incident": 1.3,
    "product_bug": 1.2,
    "customer_service": 1.0,
}

# Sentiment weights for crisis scoring (asymmetric: negative counts full)
SENTIMENT_WEIGHTS = {"negative": 1.0, "neutral": 0.5, "positive": 0.1}


class ArticleScores(BaseModel):
    """LLM output for Authority, Severity, summary and subject of an article (Agent 1)."""
    is_substantive_article: bool = Field(
        default=True,
        description="True only if this is a real news article about the company. False if newsletter signup page, promotional content, or mostly navigation/footer boilerplate."
    )
    summary: str = Field(
        max_length=300,
        description="Concise summary of the article in 1-3 sentences (max 300 chars)"
    )

    @field_validator("summary", mode="before")
    @classmethod
    def truncate_summary(cls, v: str) -> str:
        if isinstance(v, str) and len(v) > 300:
            return v[:300]
        return v
    subject: str = Field(
        description="One of: security_fraud, legal_compliance, ethics_management, labor_relations, financial_performance, operational_incident, product_bug, customer_service"
    )
    sub_theme: str = Field(
        default="",
        max_length=80,
        description="Short 2-6 word phrase for the specific angle (e.g. 'Layoff email blunder', 'Mass job cuts', 'CEO priorities backlash'). Invent a distinct angle to differentiate this article from others on similar topics.",
    )
    author: str = Field(
        default="",
        max_length=200,
        description="Author name if mentioned in the article, else empty string"
    )
    authority_score: int = Field(
        ge=1, le=5,
        description="1=Unknown, 2=Local blog, 3=Specialized press, 4=National media, 5=International media"
    )
    severity_score: int = Field(
        ge=1, le=5,
        description="1=Mild criticism, 2=Ethical, 3=Legal, 4=Fraud/Scandal, 5=Criminal"
    )
    sentiment: str = Field(
        default="neutral",
        description="One of: negative, neutral, positive. Is the article critical, balanced, or favorable toward the company?"
    )

    @field_validator("sentiment", mode="before")
    @classmethod
    def normalize_sentiment(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.lower().strip()
            if v in ("negative", "neutral", "positive"):
                return v
        return "neutral"


# --- Agent 2: Input contract from Agent 1 ---

class ArticleDetail(BaseModel):
    """Minimal article info passed from Agent 1 to Agent 2."""
    title: str
    summary: str
    severity_score: int = Field(ge=1, le=5)
    subject: str = ""


class Agent1Output(BaseModel):
    """Data extracted from Agent 1 state to feed Agent 2."""
    company_name: str
    crisis_summary: str
    severity_score: int = Field(ge=1, le=5)
    primary_threat_category: str
    articles: List[ArticleDetail] = Field(default_factory=list)


class HistoricalCrisis(BaseModel):
    """A historical PR crisis case study."""
    company: str = Field(description="Name of the company that faced the similar crisis")
    year: str = Field(default="", description="Year the crisis occurred, e.g. '2015'")
    crisis_summary: str = Field(description="One-sentence summary of the precedent")
    crisis_title: str = Field(default="", description="Short crisis title, e.g. 'Emissions Scandal'")
    crisis_type: str = Field(default="", description="Category: 'Product Safety', 'Data & Privacy', 'Regulatory & Governance', 'Reputation & Social', etc.")
    strategy_adopted: str = Field(description="PR action taken (e.g. 'Immediate apology', 'Denial', 'Legal attack')")
    outcome: str = Field(description="Final consequence (e.g. '15% stock drop', 'Scandal contained in 48h')")
    success_score: int = Field(ge=1, le=10, description="Score from 1 to 10 rating the strategy effectiveness")
    lesson: str = Field(default="", description="Key lesson learned from this specific case")
    source_url: str = Field(default="", description="URL of the primary source article for this case")


class Agent2Output(BaseModel):
    """Structured output of Agent 2 (Historical PR Strategist)."""
    past_cases: List[HistoricalCrisis] = Field(
        description="List of relevant historical cases (5-7)",
        min_length=1,
        max_length=7,
    )
    global_lesson: str = Field(description="The key strategic lesson to take away from these cases (1 sentence)")
    confidence: str = Field(
        default="medium",
        description="Confidence in the analysis: 'high', 'medium', or 'low'",
    )


# --- Agent 1: Clustering output ---

class ArticleCluster(BaseModel):
    """One cluster of similar articles with a shared title."""
    title: str = Field(description="Short 2-5 word title capturing the shared theme (e.g. 'Layoff Email Blunder', 'Mass Job Cuts')")
    article_indices: List[int] = Field(description="0-based indices of articles in this cluster")


class ArticleClusteringResult(BaseModel):
    """Result of grouping N articles into thematic clusters."""
    clusters: List[ArticleCluster] = Field(description="List of clusters, each with a title and article indices. Every article must appear in exactly one cluster.")


# --- Agent 3: Gemini structured output for Topic + Virality ---


class ArticleTopicAndViral(BaseModel):
    """LLM output for topic classification and viral coefficient (Agent 3)."""
    topic: str = Field(
        description="One of: security_fraud, legal_compliance, ethics_management, product_bug, customer_service"
    )
    viral_coefficient: float = Field(
        ge=0.5, le=3.0,
        description="0.8=Low, 1.2=Neutral, 1.5=High, 2.5=Explosive"
    )


# --- Agent 4: Strategist structured output ---


class CrisisStrategy(BaseModel):
    """One of the 3 strategies proposed by Agent 4."""
    name: str = Field(description="Strategy name: 'Offensive', 'Diplomate', or 'Silence'")
    description: str = Field(description="2-3 sentence description of the strategy approach")
    tone: str = Field(description="Communication tone: e.g. 'Firm & Legal', 'Empathetic & Transparent', 'Minimal & Observant'")
    channels: List[str] = Field(description="Communication channels to use, e.g. ['press_release', 'social_media', 'internal_email', 'legal_notice']")
    key_actions: List[str] = Field(description="3-5 concrete actions to execute")
    estimated_cost_eur: float = Field(ge=0, description="Estimated implementation cost in EUR")
    estimated_impact: str = Field(description="Expected impact: e.g. 'Reduces VaR by ~40%, high legal risk'")
    roi_score: int = Field(ge=1, le=10, description="ROI score 1-10 (10 = best return on investment)")


class Agent4Output(BaseModel):
    """Full structured output of Agent 4 (The Strategist)."""
    alert_level: str = Field(description="One of: IGNORE, SOFT, MEDIUM, CRITICAL")
    alert_reasoning: str = Field(description="1-2 sentences explaining why this alert level was chosen based on the data")
    recommended_action: str = Field(description="Primary action: 'communicate', 'monitor_only', or 'legal_action'")

    strategies: List[CrisisStrategy] = Field(
        description="Exactly 3 strategies: Offensive (legal-focused), Diplomate (empathy+facts), Silence (minimize noise)",
        min_length=3,
        max_length=3,
    )
    recommended_strategy: str = Field(description="Name of the recommended strategy (must match one of the 3)")
    recommendation_reasoning: str = Field(description="Why this strategy maximizes ROI given the data")

    press_release: str = Field(description="Draft press release (formal, 150-300 words)")
    internal_email: str = Field(description="Draft internal email to reassure employees (100-200 words)")
    social_post: str = Field(description="Draft social media post (concise, <280 chars)")
    legal_notice_draft: str = Field(default="", description="Draft legal notice / mise en demeure (only if alert_level is CRITICAL, else empty)")

    decision_summary: str = Field(description="Human-readable summary of the decision logic applied (3-5 lines)")


# --- Agent 5: CFO / Invoice structured output ---


class InvoiceLineItem(BaseModel):
    """One line on the crisis management invoice."""
    agent: str = Field(description="Agent name, e.g. 'Historical Strategist'")
    event: str = Field(description="Paid.ai event name")
    human_equivalent_value_eur: float = Field(ge=0, description="What a human consultant would charge")
    api_compute_cost_eur: float = Field(ge=0, description="Actual API cost in EUR")
    gross_margin_percent: float = Field(description="Gross margin percentage")
    detail: str = Field(default="", description="Short explanation of the billing formula")


class Agent5Output(BaseModel):
    """Structured output of Agent 5 (The CFO)."""
    tier_name: str = Field(default="", description="Pricing tier name, e.g. 'Full Defense'")
    tier_label: str = Field(default="", description="Pricing tier label, e.g. 'Crise Majeure'")
    tier_price_eur: float = Field(default=0.0, ge=0, description="Fixed tier price in EUR")
    line_items: List[InvoiceLineItem] = Field(description="Invoice line items, one per agent")
    total_human_equivalent_eur: float = Field(ge=0, description="Sum of all human-equivalent values")
    total_api_cost_eur: float = Field(ge=0, description="Sum of all actual API costs")
    total_gross_margin_percent: float = Field(description="Overall gross margin")
    roi_multiplier: float = Field(ge=0, description="How many times cheaper AI is vs human (human_value / api_cost)")
    invoice_summary: str = Field(description="1-2 sentence invoice summary for the client")
    trade_off_reasoning: str = Field(description="Why AI crisis management delivers better ROI than a traditional agency")
    action_refused: bool = Field(default=False, description="True if the crisis was too minor to warrant billable action")
    refusal_reason: str = Field(default="", description="Explanation if action was refused")


# --- Agent 6: Narrative Hijacker structured output ---


class Agent6Output(BaseModel):
    """Structured output of Agent 6 (The Narrative Hijacker)."""
    hijacker_live_url: str = Field(default="", description="Live URL of the deployed crisis landing page")
    hijacker_html_generated: bool = Field(default=False, description="Whether HTML was successfully generated")
    hijacker_deployed: bool = Field(default=False, description="Whether the page was deployed to Vercel")
    hijacker_ads_simulated: bool = Field(default=False, description="Whether ad keyword hijacking was simulated")
    hijacker_ads_keywords: int = Field(default=0, ge=0, description="Number of keywords acquired in simulation")
    hijacker_ads_budget_eur: float = Field(default=0.0, ge=0, description="Simulated ads budget in EUR")
    agent6_api_cost_eur: float = Field(default=0.0, ge=0, description="LLM API cost for HTML generation")
