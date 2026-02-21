"""
Nœud LangGraph : Agent 3 — Risk Analyst.

Transforme les scores qualitatifs de l'Agent 1 en métriques financières :
Reach (portée), Churn Risk (risque de perte client), VaR (Valeur à Risque).
Émet un signal Paid.ai à la fin (risk_assessment_completed).
"""
from src.graph.state import GraphState
from src.clients.llm_client import llm
from src.shared.types import ArticleTopicAndViral
from src.utils.paid_helpers import emit_agent3_signal

# --- Constantes de simulation (Hackathon) ---

CAC = 100  # Coût d'Acquisition Client en €
ARR = 1200  # Revenu Annuel Moyen par Client en €
TOTAL_CLIENTS = 10000  # Base client totale

# Poids des sujets (profil "Banque" par défaut)
TOPIC_WEIGHTS = {
    "security_fraud": 3.0,
    "legal_compliance": 2.0,
    "ethics_management": 1.5,
    "product_bug": 1.0,
    "customer_service": 0.5,
}


def _get_topic_weight(topic: str) -> float:
    """Retourne le poids du sujet, 1.0 par défaut si inconnu."""
    return TOPIC_WEIGHTS.get(topic.strip().lower(), 1.0)


def _analyze_topic_and_viral(title: str, content: str) -> ArticleTopicAndViral | None:
    """Appelle Gemini pour classifier le sujet et le coefficient de viralité."""
    if not llm:
        print("[AGENT 3] ⚠️ Client Gemini non configuré (GOOGLE_API_KEY manquante).")
        return None
    structured_llm = llm.with_structured_output(ArticleTopicAndViral)
    prompt = """Tu es un expert en analyse de risque médiatique.

Pour cet article, identifie :
1. **topic** : Une des 5 catégories EXACTES (écris exactement comme ci-dessous) :
   - security_fraud : fraude, fuite de données, faille de sécurité
   - legal_compliance : procès, amende, non-respect de la loi
   - ethics_management : greenwashing, mauvais management, valeurs
   - product_bug : bug produit, dysfonctionnement technique
   - customer_service : mécontentement client, service après-vente

2. **viral_coefficient** : La partageabilité (un seul chiffre parmi 0.8, 1.2, 1.5, 2.5) :
   - 0.8 : Sujet technique, financier, ennuyeux
   - 1.2 : Information factuelle simple
   - 1.5 : Indignation, humour noir, écologie, vie privée
   - 2.5 : Scandale célébrité/Top Manager, sujet polémique clivant

Titre : {title}
Extrait : {content}

Réponds uniquement avec topic et viral_coefficient.
""".format(title=title[:200], content=(content or "")[:1500])
    try:
        result = structured_llm.invoke(prompt)
        # S'assurer que viral_coefficient est une valeur standard
        v = result.viral_coefficient
        if v <= 1.0:
            result.viral_coefficient = 0.8
        elif v <= 1.35:
            result.viral_coefficient = 1.2
        elif v <= 2.0:
            result.viral_coefficient = 1.5
        else:
            result.viral_coefficient = 2.5
        return result
    except Exception as e:
        print(f"[AGENT 3] Erreur Gemini : {e}")
        return None


def _compute_reach(authority_score: int, severity_score: int, viral_coefficient: float) -> float:
    """Reach = (Authority * 20 000) * (Severity / 2) * ViralCoefficient"""
    return float((authority_score * 20_000) * (severity_score / 2) * viral_coefficient)


def _compute_churn_risk_percent(severity_score: int, topic_weight: float) -> float:
    """Churn Risk % = (Severity / 100) * Topic Weight"""
    return (severity_score / 100.0) * topic_weight


def _compute_value_at_risk(
    reach: float,
    churn_risk_percent: float,
) -> float:
    """VaR = (Reach * CAC) + ((ChurnRisk% * TOTAL_CLIENTS) * ARR)"""
    cost_marketing = reach * CAC
    clients_at_risk = churn_risk_percent * TOTAL_CLIENTS
    revenue_loss = clients_at_risk * ARR
    return cost_marketing + revenue_loss


def scorer_node(state: GraphState) -> dict:
    """
    Agent 3 : analyse chaque article, calcule Reach, Churn Risk, VaR.
    Enrichit les articles et calcule total_var_impact.
    """
    customer_id = state.get("customer_id", "")
    crisis_id = state.get("crisis_id", "")
    articles = list(state.get("articles", []))

    if not articles:
        print("[AGENT 3] Aucun article à analyser (Agent 1 n'a pas fourni d'articles).")
        return {
            "total_var_impact": 0.0,
            "estimated_financial_loss": 0.0,
            "severity_score": 0,
            "articles": [],
        }

    total_var_impact = 0.0
    max_severity = 0
    enriched_articles = []

    for art in articles:
        title = art.get("title", "")
        content = art.get("content", "")
        authority_score = int(art.get("authority_score", 3))
        severity_score = int(art.get("severity_score", 2))

        # Classification topic + viralité via Gemini
        topic_viral = _analyze_topic_and_viral(title, content)
        if topic_viral:
            topic_weight = _get_topic_weight(topic_viral.topic)
            viral_coefficient = float(topic_viral.viral_coefficient)
        else:
            topic_weight = 1.0
            viral_coefficient = 1.2

        # Formules de calcul
        reach = _compute_reach(authority_score, severity_score, viral_coefficient)
        churn_risk_decimal = _compute_churn_risk_percent(severity_score, topic_weight)
        value_at_risk = _compute_value_at_risk(reach, churn_risk_decimal)

        # Arrondi 2 décimales
        reach = round(reach, 2)
        churn_risk_percent = round(churn_risk_decimal * 100, 2)  # pour affichage (ex: 15.0)
        value_at_risk = round(value_at_risk, 2)

        art_enriched = {
            **art,
            "reach_estimate": reach,
            "churn_risk_percent": churn_risk_percent,
            "value_at_risk": value_at_risk,
        }
        enriched_articles.append(art_enriched)

        total_var_impact += value_at_risk
        max_severity = max(max_severity, severity_score)

        print(
            f"[AGENT 3] Analyse Risque : {title[:50]}... | "
            f"Reach: {reach:,.0f} | VaR: {value_at_risk:,.2f}€"
        )

    total_var_impact = round(total_var_impact, 2)
    estimated_financial_loss = total_var_impact

    # Signal Paid.ai (uniquement si des articles ont été analysés)
    if enriched_articles and customer_id and crisis_id:
        api_compute_cost_eur = state.get("agent3_api_cost_eur", 0.08)
        emit_agent3_signal(
            customer_external_id=customer_id,
            crisis_id=crisis_id,
            estimated_financial_loss=estimated_financial_loss,
            severity_score=max_severity or 3,
            api_compute_cost_eur=api_compute_cost_eur,
        )

    return {
        "articles": enriched_articles,
        "total_var_impact": total_var_impact,
        "estimated_financial_loss": estimated_financial_loss,
        "severity_score": max_severity,
    }
