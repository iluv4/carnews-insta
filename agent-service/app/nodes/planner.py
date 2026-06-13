"""Planner node — turns a raw topic into a slide-by-slide plan."""
from __future__ import annotations

from ..models import chat_json
from ..schemas import AgentState

_ROLES = ["cover", "review", "menu", "cta", "info", "closing"]

SYSTEM = "You are a senior content strategist for Korean Instagram card news. Output ONLY JSON."


def _fallback_plan(n: int) -> list[dict]:
    seq = ["cover"] + ["info"] * max(0, n - 2) + (["cta"] if n > 1 else [])
    seq = seq[:n]
    return [{"role": r, "intent": f"슬라이드 {i + 1}"} for i, r in enumerate(seq)]


def planner(state: AgentState) -> AgentState:
    topic = state.get("topic", "")
    n = int(state.get("num_slides", 3))
    audience = state.get("audience") or "일반 인스타그램 사용자"
    prompt = (
        f'주제: "{topic}"\n타깃: {audience}\n슬라이드 수: {n}\n\n'
        f"각 슬라이드의 role과 한 줄 intent를 정하라. role은 {_ROLES} 중에서 고른다.\n"
        '반드시 이 JSON: {"slides":[{"role":"cover","intent":"..."}]}'
    )
    data = chat_json(SYSTEM, prompt, max_tokens=600)
    slides = data.get("slides") if isinstance(data, dict) else None
    if not slides or not isinstance(slides, list):
        slides = _fallback_plan(n)
    return {"plan": slides[:n]}
