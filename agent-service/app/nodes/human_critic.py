"""Human Critic node — the manual counterpart to the Art Director.

Turns a person's evaluation into the exact `critique` shape the rest of the loop
already understands (a numeric score + a list of fixes). Because it speaks the
same contract as `art_director`, the existing `reviser → designer` machinery
consumes human feedback unchanged — the only difference is *who* did the judging.

This is the piece that was missing: a place where a human's eyes drive the
self-correction loop, instead of the loop being fully automated.
"""
from __future__ import annotations

from ..schemas import AgentState


def human_critic(state: AgentState) -> AgentState:
    fb = state.get("human_feedback") or {}
    score = float(fb.get("score", 0.0))
    fixes = [str(n).strip() for n in (fb.get("notes") or []) if str(n).strip()]
    return {
        "critique": {
            "score": score,
            "fixes": fixes,
            "issues": fixes,
            "source": "human",
        },
        "score": score,
    }
