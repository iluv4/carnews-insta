"""Budgeter node — Test-Time Scaling "budget forcing" (S1).

Sits between the planner and the retriever: it estimates how hard the topic is,
then writes the per-request inference budget into state — how many Best-of-N copy
candidates to sample and how high the per-slide revision loop may climb. Hard
decks get more inference compute; easy decks stay cheap. No training involved.
"""
from __future__ import annotations

from ..schemas import AgentState
from ..tts import budget_for, estimate_difficulty


def budgeter(state: AgentState) -> AgentState:
    difficulty = estimate_difficulty(state.get("topic", ""), state.get("plan", []))
    budget = budget_for(difficulty)
    # max_revisions / threshold flow into each render_slide branch via _slide_seed,
    # so the critique loop inherits the forced budget automatically.
    return {
        "difficulty": budget["difficulty"],
        "n_samples": budget["n_samples"],
        "max_revisions": budget["max_revisions"],
        "threshold": budget["threshold"],
        "budget": budget,
    }
