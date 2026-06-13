"""Designer node — turns copy + retrieved style into a gpt-image-2 prompt.

Because the user chose *full-card* generation, the designer's job is to write a
precise art-direction prompt that bakes the cover slide's text into the image.
The retrieved exemplars' palette/mood steer the visual style. On a revision
pass, the Art Director's fixes are appended as hard constraints.
"""
from __future__ import annotations

from ..models import chat_json
from ..schemas import AgentState

SYSTEM = "You are an art director writing prompts for an image model. Output ONLY JSON."


def _cover(copy: dict) -> dict:
    slides = copy.get("slides", []) if isinstance(copy, dict) else []
    return slides[0] if slides else {}


def _fallback_prompt(state: AgentState, cover: dict) -> str:
    title = cover.get("title") or state.get("topic", "")
    brand = state.get("brand") or ""
    return (
        "Premium Korean Instagram card-news cover, 2:3 portrait, editorial magazine aesthetic, "
        "clean typographic hierarchy, studio lighting, high contrast, depth of field. "
        f'Korean headline text rendered crisply: "{title}". '
        f'{("Small brand mark: " + brand + ". ") if brand else ""}'
        "No watermark, no gibberish text, no extra symbols."
    )


def designer(state: AgentState) -> AgentState:
    cover = _cover(state.get("copy", {}))
    examples = state.get("examples", [])
    notes = state.get("revision_notes", [])
    style = "; ".join(e["summary"] for e in examples[:2]) or "modern editorial"
    fixes_block = ("\n반드시 반영할 수정 지시: " + " / ".join(notes)) if notes else ""

    prompt = (
        f"커버 카피: {cover}\n"
        f"참고 스타일(실제 인기 디자인): {style}\n"
        f"브랜드 마크: {state.get('brand') or '(없음)'}{fixes_block}\n\n"
        "위를 바탕으로 gpt-image-2용 영어 이미지 프롬프트 1개를 작성하라. "
        "2:3 세로 카드, 한국어 제목 텍스트가 또렷하게 박히도록 명시, 잡티/오타/워터마크 금지를 포함.\n"
        '반드시 이 JSON: {"image_prompt":"...","design_brief":{"mood":"...","palette":"...","layout":"..."}}'
    )
    data = chat_json(SYSTEM, prompt, max_tokens=700)
    image_prompt = (data or {}).get("image_prompt") if isinstance(data, dict) else None
    brief = (data or {}).get("design_brief", {}) if isinstance(data, dict) else {}
    if not image_prompt:
        image_prompt = _fallback_prompt(state, cover)
    return {"image_prompt": image_prompt, "design_brief": brief}
