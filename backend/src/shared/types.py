"""
Schémas Pydantic partagés (Article, scores Agent 1, etc.).
"""
from pydantic import BaseModel, Field


# --- Agent 1 : Sortie structurée Gemini pour scoring article ---

class ArticleScores(BaseModel):
    """Sortie LLM pour Authority et Severity d'un article."""
    authority_score: int = Field(
        ge=1, le=5,
        description="1=Inconnu, 2=Blog local, 3=Presse spécialisée, 4=Média national, 5=Média international"
    )
    severity_score: int = Field(
        ge=1, le=5,
        description="1=Mild criticism, 2=Ethical, 3=Legal, 4=Fraud/Scandal, 5=Criminal"
    )
