"""
Shared Pydantic schemas (Article, Agent 1 scores, etc.).
"""
from pydantic import BaseModel, Field


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
    summary: str = Field(
        max_length=300,
        description="Concise summary of the article in 1-3 sentences (max 300 chars)"
    )
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
