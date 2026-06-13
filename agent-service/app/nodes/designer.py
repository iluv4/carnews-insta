"""Designer node — turns copy + retrieved style into a background-image prompt.

The card's Korean text is rendered as a crisp typographic overlay by the client
(diffusion models bake unreliable, often garbled Korean glyphs — so we keep text
OUT of the image). The designer's job is therefore to art-direct a clean,
text-free background photo with deliberate empty space for the overlay. The
retrieved exemplars' palette/mood steer the visual style. On a revision pass,
the Art Director's fixes are appended as hard constraints.
"""
from __future__ import annotations

from ..models import chat_json
from ..schemas import AgentState

SYSTEM = "You are an art director writing prompts for an image model. Output ONLY JSON."


def _cover(copy: dict) -> dict:
    slides = copy.get("slides", []) if isinstance(copy, dict) else []
    return slides[0] if slides else {}


def _fallback_prompt(state: AgentState, cover: dict) -> str:
    subject = cover.get("title") or state.get("topic", "")
    return (
        "Premium Korean Instagram card-news BACKGROUND, 2:3 portrait, editorial "
        "magazine aesthetic, studio lighting, shallow depth of field, rich color. "
        f"Subject/scene: {subject}. "
        "Compose with clean negative space in the lower third for a text overlay. "
        "Absolutely NO text, NO letters, NO words, NO typography, NO logos, "
        "NO watermark, NO captions anywhere in the image."
    )


def designer(state: AgentState) -> AgentState:
    cover = _cover(state.get("copy", {}))
    examples = state.get("examples", [])
    notes = state.get("revision_notes", [])
    style = "; ".join(e["summary"] for e in examples[:2]) or "modern editorial"
    fixes_block = ("\n반드시 반영할 수정 지시: " + " / ".join(notes)) if notes else ""

    prompt = (
        f"커버 카피(텍스트는 이미지에 넣지 말고 분위기/소재 참고용): {cover}\n"
        f"참고 스타일(실제 인기 디자인): {style}\n"
        f"브랜드: {state.get('brand') or '(없음)'}{fixes_block}\n\n"
        "위를 바탕으로 gpt-image-2용 영어 '배경 이미지' 프롬프트 1개를 작성하라. "
        "2:3 세로, 하단 1/3에 텍스트 오버레이용 여백을 확보하도록 구도를 지시하고, "
        "이미지 안에는 글자/문자/단어/타이포/로고/워터마크가 절대 없도록 'no text' 류 "
        "제약을 반드시 포함하라.\n"
        '반드시 이 JSON: {"image_prompt":"...","design_brief":{"mood":"...","palette":"...","layout":"..."}}'
    )
    data = chat_json(SYSTEM, prompt, max_tokens=700)
    image_prompt = (data or {}).get("image_prompt") if isinstance(data, dict) else None
    brief = (data or {}).get("design_brief", {}) if isinstance(data, dict) else {}
    if not image_prompt:
        image_prompt = _fallback_prompt(state, cover)
    return {"image_prompt": image_prompt, "design_brief": brief}
