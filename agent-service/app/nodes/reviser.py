"""Reviser node — converts the critic's + OCR gate's fixes into next-pass notes."""
from __future__ import annotations

from ..schemas import AgentState


def reviser(state: AgentState) -> AgentState:
    critique = state.get("critique", {})
    fixes = list(critique.get("fixes") or critique.get("issues") or [])
    # Text-fidelity problems from the OCR gate are first-class revision notes:
    # for a baked card, "the headline is garbled" is the most important fix.
    fixes = list(state.get("text_issues") or []) + fixes
    revision = int(state.get("revision", 0)) + 1
    # These notes flow back into designer (and copywriter) on the next loop.
    return {
        "revision": revision,
        "revision_notes": [str(f) for f in fixes][:6],
    }
