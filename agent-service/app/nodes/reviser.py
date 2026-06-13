"""Reviser node — converts the critic's fixes into next-pass instructions."""
from __future__ import annotations

from ..schemas import AgentState


def reviser(state: AgentState) -> AgentState:
    critique = state.get("critique", {})
    fixes = critique.get("fixes") or critique.get("issues") or []
    revision = int(state.get("revision", 0)) + 1
    # These notes flow back into designer (and copywriter) on the next loop.
    return {
        "revision": revision,
        "revision_notes": [str(f) for f in fixes][:6],
    }
