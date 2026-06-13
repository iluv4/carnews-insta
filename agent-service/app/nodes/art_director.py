"""Art Director node — the vision critic that scores the generated card.

This is what turns a one-shot generator into a self-improving agent: the
rendered card is fed back to a vision model with a rubric, producing a numeric
score + concrete fixes that the Reviser turns into the next attempt.
"""
from __future__ import annotations

from ..config import get_settings
from ..models import vision_json
from ..schemas import AgentState

SYSTEM = "You are a meticulous art director reviewing a Korean card-news image. Output ONLY JSON."

RUBRIC = (
    "다음 기준으로 0~10점 채점하라: 가독성/대비, 시각적 위계, 한국어 타이포 품질, "
    "브랜드 일관성, 오타·깨진 글자·잡티 유무. 문제와 구체적 수정안을 나열하라.\n"
    '반드시 이 JSON: {"score":0-10,"readability":"...","hierarchy":"...",'
    '"typography":"...","brand_consistency":"...","issues":["..."],"fixes":["..."]}'
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
    data = vision_json(SYSTEM, RUBRIC, img, max_tokens=700)
    score = float(data.get("score", 0)) if isinstance(data, dict) else 0.0
    if not data:
        data = {"score": thr, "issues": [], "fixes": [], "note": "critic unavailable"}
        score = thr
    data["score"] = score
    return {"critique": data, "score": score}
