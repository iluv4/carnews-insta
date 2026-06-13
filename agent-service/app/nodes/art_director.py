"""Art Director node — the vision critic that scores the finished card.

This is what turns a one-shot generator into a self-improving agent: the
rendered card is fed back to a vision model with a rubric, producing a numeric
score + concrete fixes that the Reviser turns into the next attempt.

Since we now BAKE the Korean copy into the image, the critic's job flipped: it
no longer penalises text in the image — it *requires* it, and judges whether the
baked headline/bullets are legible, correctly spelled, and well-composed. The
separate ``ocr_gate`` node owns the exact text-diff; the art director owns the
aesthetic + legibility judgement that OCR can't see.
"""
from __future__ import annotations

from ..config import get_settings
from ..models import vision_json
from ..schemas import AgentState

SYSTEM = (
    "You are a meticulous art director reviewing a FINISHED Korean card-news card "
    "that has its Korean text baked into the image. Output ONLY JSON."
)

RUBRIC = (
    "이 카드에는 아래 한국어 텍스트가 이미지 안에 직접 렌더링돼 있어야 한다:\n"
    "{intended}\n\n"
    "다음 기준으로 0~10점 채점하라: (1) 텍스트 정확성 — 위 문구가 오타·누락·깨진 "
    "글자(헛글자) 없이 또렷하게 보이는가 [가장 중요, 깨지면 큰 감점], (2) 가독성/대비, "
    "(3) 구도·시각적 위계, (4) 색·무드의 매력, (5) 잡티·아티팩트 유무.\n"
    "글자가 깨졌거나 안 보이면 fixes에 'Re-render the card with the Korean text "
    "spelled EXACTLY as specified, crisp and legible' 를 넣어라.\n"
    '반드시 이 JSON: {"score":0-10,"text_correct":true|false,"garbled":true|false,'
    '"readability":"...","composition":"...","palette":"...","issues":["..."],"fixes":["..."]}'
)


def art_director(state: AgentState) -> AgentState:
    thr = get_settings().quality_threshold
    img = state.get("card_image_b64")
    if not img:
        # Nothing rendered (no key / skipped) — pass through without blocking.
        return {
            "critique": {"score": thr, "issues": [], "fixes": [], "note": "no image to review"},
            "score": thr,
        }
    intended = "\n".join(f'  · "{t}"' for t in state.get("intended_text", [])) or "  · (없음)"
    data = vision_json(SYSTEM, RUBRIC.replace("{intended}", intended), img, max_tokens=700)
    score = float(data.get("score", 0)) if isinstance(data, dict) else 0.0
    if not data:
        data = {"score": thr, "issues": [], "fixes": [], "note": "critic unavailable"}
        score = thr
    data["score"] = score
    return {"critique": data, "score": score}
