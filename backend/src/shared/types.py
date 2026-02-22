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
    "product_bug",
    "customer_service",
)

SUBJECT_DISPLAY_NAMES = {
    "security_fraud": "Security & Fraud",
    "legal_compliance": "Legal & Compliance",
    "ethics_management": "Ethics & Management",
    "product_bug": "Product & Technical",
    "customer_service": "Customer Service",
}


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
        description="One of: security_fraud, legal_compliance, ethics_management, product_bug, customer_service"
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


# --- Agent 2: Input contract from Agent 1 ---

class Agent1Output(BaseModel):
    """Data extracted from Agent 1 state to feed Agent 2."""
    company_name: str
    crisis_summary: str
    severity_score: int = Field(ge=1, le=5)
    primary_threat_category: str


class HistoricalCrisis(BaseModel):
    """A historical PR crisis case study."""
    company: str = Field(description="Name of the company that faced the similar crisis")
    crisis_summary: str = Field(description="One-sentence summary of the precedent")
    strategy_adopted: str = Field(description="PR action taken (e.g. 'Immediate apology', 'Denial', 'Legal attack')")
    outcome: str = Field(description="Final consequence (e.g. '15% stock drop', 'Scandal contained in 48h')")
    success_score: int = Field(ge=1, le=10, description="Score from 1 to 10 rating the strategy effectiveness")
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
