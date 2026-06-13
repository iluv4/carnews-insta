"""Art Director node — the vision critic that scores the generated card.

This is what turns a one-shot generator into a self-improving agent: the
rendered card is fed back to a vision model with a rubric, producing a numeric
score + concrete fixes that the Reviser turns into the next attempt.
"""
from __future__ import annotations

from ..config import get_settings
from ..models import vision_json
from ..schemas import AgentState

SYSTEM = (
    "You are a meticulous art director reviewing the BACKGROUND image of a "
    "Korean card-news card. The Korean text is added later as a crisp overlay, "
    "so the image itself must contain NO text. Output ONLY JSON."
)

RUBRIC = (
    "다음 기준으로 0~10점 채점하라: 구도/시각적 위계, 색·무드의 매력, 하단 "
    "텍스트 오버레이용 여백 확보 여부, 잡티·아티팩트 유무. \n"
    "중요: 이미지 안에 글자/문자/워터마크가 보이면 큰 감점하고 fixes에 'remove all "
    "text/letters from the image' 를 넣어라 (텍스트는 오버레이로 들어가므로 배경엔 "
    "절대 없어야 함).\n"
    '반드시 이 JSON: {"score":0-10,"composition":"...","palette":"...",'
    '"overlay_space":"...","has_text":true|false,"issues":["..."],"fixes":["..."]}'
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
