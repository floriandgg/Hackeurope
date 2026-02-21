"""
Token and cost tracking for every LLM call. Person 4 (Glue).
"""
from dataclasses import dataclass, field
from typing import Optional

# Example pricing (adjust to actual Claude Sonnet 4)
INPUT_PRICE_PER_1K = 0.003
OUTPUT_PRICE_PER_1K = 0.015


@dataclass
class CostSnapshot:
    tokens_in: int = 0
    tokens_out: int = 0
    phase_cost_eur: float = 0.0
    total_cost_eur: float = 0.0

    def add_usage(self, tokens_in: int, tokens_out: int) -> None:
        self.tokens_in += tokens_in
        self.tokens_out += tokens_out
        self.phase_cost_eur += (
            tokens_in / 1000 * INPUT_PRICE_PER_1K + tokens_out / 1000 * OUTPUT_PRICE_PER_1K
        )
        self.total_cost_eur = self.phase_cost_eur  # Can be extended to accumulate across phases


def compute_cost_eur(tokens_in: int, tokens_out: int) -> float:
    return (
        tokens_in / 1000 * INPUT_PRICE_PER_1K + tokens_out / 1000 * OUTPUT_PRICE_PER_1K
    )
