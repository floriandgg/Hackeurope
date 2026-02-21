"""
Schémas Pydantic partagés (Article, scores Agent 1, etc.).
"""
from pydantic import BaseModel, Field


# --- Agent 1 : Sortie structurée Gemini pour scoring article ---

class ArticleScores(BaseModel):
    """Sortie LLM pour Authority, Severity et résumé d'un article (Agent 1)."""
    summary: str = Field(
        max_length=300,
        description="Résumé concis de l'article en 1 à 3 phrases (max 300 caractères)"
    )
    authority_score: int = Field(
        ge=1, le=5,
        description="1=Inconnu, 2=Blog local, 3=Presse spécialisée, 4=Média national, 5=Média international"
    )
    severity_score: int = Field(
        ge=1, le=5,
        description="1=Mild criticism, 2=Ethical, 3=Legal, 4=Fraud/Scandal, 5=Criminal"
    )


# --- Agent 3 : Sortie structurée Gemini pour Topic + Viralité ---


class ArticleTopicAndViral(BaseModel):
    """Sortie LLM pour classification du sujet et coefficient de viralité (Agent 3)."""
    topic: str = Field(
        description="Une des clés exactes: security_fraud, legal_compliance, ethics_management, product_bug, customer_service"
    )
    viral_coefficient: float = Field(
        ge=0.5, le=3.0,
        description="0.8=Faible, 1.2=Neutre, 1.5=Élevé, 2.5=Explosif"
    )
