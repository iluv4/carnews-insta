"""Designer node — turns copy + retrieved style into a FULL-CARD image prompt.

Design decision (2026-06-13): we BAKE the Korean copy directly into the image
("박기 올인"). The image model renders the finished card — headline, bullets,
footer — so the output is a publishable card, not an editable draft. This drops
the whole client-side text-layer/overlay engineering that an Instagram-card MVP
doesn't need.

The trade-off is glyph fidelity: an image model can still mis-render Korean, so
the designer's prompt names the *exact* strings to render (quoted), and a
downstream `ocr_gate` node verifies them and loops back on a mismatch. The
retrieved exemplars steer palette/typography/mood. On a revision pass, the Art
Director's + OCR gate's fixes are appended as hard constraints.
"""
from __future__ import annotations

from ..models import chat_json
from ..schemas import AgentState

SYSTEM = "You are an art director writing prompts for an image model. Output ONLY JSON."


def _cover(copy: dict) -> dict:
    slides = copy.get("slides", []) if isinstance(copy, dict) else []
    return slides[0] if slides else {}


def intended_text(cover: dict) -> list[str]:
    """The exact strings that must appear, in reading order — the OCR target."""
    out: list[str] = []
    for key in ("title", "subtitle"):
        v = cover.get(key)
        if v:
            out.append(str(v))
    for b in cover.get("bullets", []) or []:
        if b:
            out.append(str(b))
    if cover.get("footer"):
        out.append(str(cover["footer"]))
    return out


def _quoted(lines: list[str]) -> str:
    return "\n".join(f'  · "{ln}"' for ln in lines) or "  · (없음)"


def _fallback_prompt(state: AgentState, lines: list[str]) -> str:
    body = " | ".join(lines) or state.get("topic", "")
    return (
        "Premium Korean Instagram card-news FINISHED CARD, 2:3 portrait, editorial "
        "magazine aesthetic, studio lighting, rich color, strong visual hierarchy. "
        "Render the following Korean text EXACTLY as written, with crisp, perfectly "
        "legible typography and NO garbled, invented or misspelled glyphs: "
        f"{body}. "
        "Headline large and bold at the top, supporting lines clearly arranged, "
        "high contrast between text and background for readability."
    )


def designer(state: AgentState) -> AgentState:
    cover = _cover(state.get("copy", {}))
    lines = intended_text(cover)
    examples = state.get("examples", [])
    notes = state.get("revision_notes", [])
    style = "; ".join(e["summary"] for e in examples[:2]) or "modern editorial"
    fixes_block = ("\n반드시 반영할 수정 지시: " + " / ".join(notes)) if notes else ""

    prompt = (
        "한국어 인스타 카드뉴스 '완성본' 1장을 만드는 gpt-image-2 영어 프롬프트를 작성하라.\n"
        "텍스트는 오버레이가 아니라 '이미지 안에 직접' 정확히 렌더링돼야 한다.\n\n"
        f"이미지에 반드시 정확히 들어갈 한국어 텍스트(따옴표 안 그대로, 오타/누락/깨진 글자 금지):\n"
        f"{_quoted(lines)}\n\n"
        f"참고 스타일(실제 인기 디자인): {style}\n"
        f"브랜드: {state.get('brand') or '(없음)'}{fixes_block}\n\n"
        "요구사항: 2:3 세로, 제목은 크고 굵게, 본문은 정렬, 텍스트-배경 대비 높게, "
        "한글 글자가 또렷하고 정확하게(Render the Korean text EXACTLY, crisp legible "
        "typography, no garbled/invented glyphs). 워터마크 금지.\n"
        '반드시 이 JSON: {"image_prompt":"...","design_brief":{"mood":"...","palette":"...","layout":"..."}}'
    )
    data = chat_json(SYSTEM, prompt, max_tokens=800)
    image_prompt = (data or {}).get("image_prompt") if isinstance(data, dict) else None
    brief = (data or {}).get("design_brief", {}) if isinstance(data, dict) else {}
    if not image_prompt:
        image_prompt = _fallback_prompt(state, lines)
    return {"image_prompt": image_prompt, "design_brief": brief, "intended_text": lines}
