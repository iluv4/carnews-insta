"""Copywriter node — generates slide copy grounded in retrieved exemplars."""
from __future__ import annotations

from ..models import chat_json
from ..schemas import AgentState

SYSTEM = "You are an award-winning Korean copywriter for Instagram card news. Output ONLY JSON."


def _fallback_copy(topic: str, plan: list[dict]) -> dict:
    slides = []
    for i, p in enumerate(plan):
        slides.append(
            {
                "role": p.get("role", "info"),
                "title": topic if i == 0 else f"{topic} 포인트 {i}",
                "subtitle": "",
                "bullets": ["😍 핵심 1", "😎 핵심 2", "🤤 핵심 3"],
                "footer": "팔로우하고 더 보기",
            }
        )
    return {"slides": slides}


def copywriter(state: AgentState) -> AgentState:
    topic = state.get("topic", "")
    plan = state.get("plan", [])
    examples = state.get("examples", [])
    notes = state.get("revision_notes", [])

    ex_block = "\n".join(f"- [{e['template_id']}] {e['summary']}" for e in examples) or "(없음)"
    plan_block = "\n".join(f"{i + 1}. {p.get('role')} — {p.get('intent', '')}" for i, p in enumerate(plan))
    revision_block = ("\n\n[직전 비평 반영 지시]\n- " + "\n- ".join(notes)) if notes else ""

    prompt = (
        f'주제: "{topic}"\n\n'
        f"[슬라이드 플랜]\n{plan_block}\n\n"
        f"[참고할 실제 인기 디자인의 카피 톤 — 이 톤/리듬을 모방하되 복붙 금지]\n{ex_block}\n"
        f"{revision_block}\n\n"
        "각 슬라이드의 한국어 카피를 작성하라. 제목은 임팩트, 본문은 이모지 불릿 2~3개.\n"
        '반드시 이 JSON: {"slides":[{"role":"cover","title":"...","subtitle":"...",'
        '"bullets":["😍 ...","😎 ..."],"footer":"..."}]}'
    )
    data = chat_json(SYSTEM, prompt, max_tokens=1400)
    slides = data.get("slides") if isinstance(data, dict) else None
    if not slides or not isinstance(slides, list):
        data = _fallback_copy(topic, plan)
    return {"copy": data}
