"""
Test Agent 2 with a simulated Agent 1 output (no real Agent 1 call).
Simulates a Buitoni food contamination crisis.
"""
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")

print("=" * 70)
print("  AGENT 2 TEST — Simulated Agent 1 Output")
print("=" * 70)

# Simulated Agent 1 output as GraphState
simulated_state = {
    "company_name": "Buitoni",
    "customer_id": "test_buitoni_001",
    "crisis_id": "test-crisis-buitoni-2026",
    "articles": [
        {
            "title": "Buitoni pizzas linked to E. coli contamination in France",
            "summary": "Nestle's Buitoni brand faces major crisis after contaminated Fraich'Up pizzas caused E. coli infections in dozens of children, with two deaths reported.",
            "severity_score": 5,
            "authority_score": 5,
            "subject": "product_bug",
            "url": "https://example.com/article1",
        },
        {
            "title": "French authorities investigate Buitoni factory hygiene failures",
            "summary": "Health inspectors found severe hygiene violations at Buitoni's Caudry factory, including rodent droppings and mold on production lines.",
            "severity_score": 5,
            "authority_score": 4,
            "subject": "legal_compliance",
            "url": "https://example.com/article2",
        },
        {
            "title": "Nestle faces class action lawsuit over Buitoni contamination",
            "summary": "Families of affected children launch class action against Nestle, demanding compensation for medical costs and emotional damages.",
            "severity_score": 4,
            "authority_score": 4,
            "subject": "legal_compliance",
            "url": "https://example.com/article3",
        },
    ],
}

print(f"\nSimulated crisis: {simulated_state['company_name']}")
print(f"Articles: {len(simulated_state['articles'])}")
print(f"Max severity: {max(a['severity_score'] for a in simulated_state['articles'])}")
print("-" * 70)

t0 = time.time()

from src.agents.agent_2_precedents.node import precedents_node

result = precedents_node(simulated_state)

elapsed = time.time() - t0

print("\n" + "=" * 70)
print("  RESULTS")
print("=" * 70)

print(f"\nTime: {elapsed:.1f}s")
print(f"Confidence: {result.get('confidence', 'N/A')}")
print(f"API cost: {result.get('agent2_api_cost_eur', 0):.4f} EUR")
print(f"Global lesson: {result.get('global_lesson', 'N/A')}")

precedents = result.get("precedents", [])
print(f"\n--- {len(precedents)} Historical Cases ---")
for i, case in enumerate(precedents, 1):
    print(f"\n  Case {i}: {case['company']}")
    print(f"    Crisis: {case['crisis_summary']}")
    print(f"    Strategy: {case['strategy_adopted']}")
    print(f"    Outcome: {case['outcome']}")
    print(f"    Score: {case['success_score']}/10")
    print(f"    Source: {case.get('source_url', 'N/A')}")

sources = result.get("agent2_sources", [])
print(f"\n--- {len(sources)} Grounding Sources ---")
for i, src in enumerate(sources, 1):
    print(f"  {i}. [{src.get('phase', '?')}] {src.get('title', 'N/A')}")
    print(f"     {src.get('url', 'N/A')}")

print("\n" + "=" * 70)
print("  VALIDATION")
print("=" * 70)

errors = []
if not precedents:
    errors.append("No precedents returned")
if len(precedents) < 3:
    errors.append(f"Only {len(precedents)} cases (expected 3-5)")
if result.get("confidence") not in ("low", "medium", "high"):
    errors.append(f"Invalid confidence: {result.get('confidence')}")
if not result.get("global_lesson"):
    errors.append("Missing global_lesson")
if "agent2_sources" not in result:
    errors.append("Missing agent2_sources in result")

for case in precedents:
    if not case.get("source_url"):
        errors.append(f"Case '{case['company']}' has no source_url")
    if case.get("success_score", 0) < 1 or case.get("success_score", 0) > 10:
        errors.append(f"Case '{case['company']}' has invalid score: {case['success_score']}")

if errors:
    print("\nFAILED:")
    for e in errors:
        print(f"  [X] {e}")
else:
    print("\nALL CHECKS PASSED")

print(f"\nTotal time: {elapsed:.1f}s")
