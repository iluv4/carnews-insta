"""Art Director node — the vision critic that scores the generated card.

This is what turns a one-shot generator into a self-improving agent: the
rendered card is fed back to a vision model with a rubric, producing a numeric
score + concrete fixes that the Reviser turns into the next attempt.

The critic scores the BACKGROUND image (Korean copy is added later as a crisp
CSS overlay, so the image itself must be text-free). Rather than ask the model
for one fuzzy number, it grades five weighted design axes; the overall score is
then aggregated **deterministically in Python** — LLMs are unreliable at the
arithmetic, and a fixed formula makes the quality gate stable and explainable.
"""
from __future__ import annotations

from typing import Any, Optional

from ..config import get_settings
from ..models import vision_json
from ..schemas import AgentState

SYSTEM = (
    "You are a meticulous art director reviewing the BACKGROUND image of a "
    "Korean card-news card. The Korean text is added later as a crisp overlay, "
    "so the image itself must contain NO text. Output ONLY JSON."
)

# Per-axis weights (sum = 1.0). Tuned for a Korean card-news *background*:
# leaving clean room for the text overlay matters as much as composition, and a
# text-free, artifact-free image is non-negotiable for the product.
RUBRIC_WEIGHTS: dict[str, float] = {
    "composition": 0.25,    # 구도 / 시각적 위계 — 시선 흐름·균형·주제 강조
    "overlay_space": 0.25,  # 하단 1/3 텍스트 오버레이용 깨끗한 여백
    "color_mood": 0.20,     # 색 · 무드의 매력과 주제 적합성
    "cleanliness": 0.15,    # 잡티 · 왜곡 · 비현실적 아티팩트 없음
    "text_free": 0.15,      # 이미지 내 글자 / 로고 / 워터마크 없음
}

# Baked-in text is a hard product failure (the overlay would collide with it),
# so when the critic flags it we cap the overall score regardless of the rest.
TEXT_GATE_CAP = 4.0

RUBRIC = (
    "이 배경 이미지를 아래 5개 축으로 각각 0~10점 채점하라 (한국어 카드뉴스 배경 기준).\n"
    "1) composition(구도/위계): 시선 흐름·균형·주제 강조가 좋은가\n"
    "2) overlay_space(여백): 하단 1/3에 한국어 카피를 얹을 깨끗한 빈 공간이 있는가\n"
    "3) color_mood(색·무드): 팔레트의 매력과 주제 적합성, 분위기\n"
    "4) cleanliness(완성도): 잡티·왜곡·이상한 아티팩트·비현실적 형태가 없는가\n"
    "5) text_free(무문자): 이미지 안에 글자/문자/숫자/로고/워터마크가 전혀 없는가 "
    "(조금이라도 보이면 0~2점으로 주고 has_text=true)\n"
    "각 축마다 점수와 한 줄 코멘트를 달아라. issues는 구체적 문제, fixes는 다음 이미지 "
    "생성 프롬프트에 그대로 넣을 수 있는 영어 수정 지시문으로 적어라.\n"
    '반드시 이 JSON만 출력: {"axes":{'
    '"composition":{"score":0-10,"comment":"..."},'
    '"overlay_space":{"score":0-10,"comment":"..."},'
    '"color_mood":{"score":0-10,"comment":"..."},'
    '"cleanliness":{"score":0-10,"comment":"..."},'
    '"text_free":{"score":0-10,"comment":"..."}},'
    '"has_text":true|false,"issues":["..."],"fixes":["..."]}'
)


def _axis_score(axes: Any, key: str) -> Optional[float]:
    """Pull one axis score, clamped to 0–10. Accepts {"score":n} or a bare n."""
    if not isinstance(axes, dict):
        return None
    a = axes.get(key)
    raw = a.get("score") if isinstance(a, dict) else a
    try:
        return max(0.0, min(10.0, float(raw)))
    except (TypeError, ValueError):
        return None


def aggregate(axes: Any, has_text: bool) -> Optional[float]:
    """Weighted 0–10 score from the per-axis rubric — pure and deterministic.

    Missing/invalid axes are dropped and the remaining weights renormalised, so
    a partial critic response still yields a sensible score. Returns ``None``
    when no axis is usable (caller decides how to fall back). Baked-in text caps
    the score at :data:`TEXT_GATE_CAP`.
    """
    acc = 0.0
    total_w = 0.0
    for key, weight in RUBRIC_WEIGHTS.items():
        sc = _axis_score(axes, key)
        if sc is None:
            continue
        acc += sc * weight
        total_w += weight
    if total_w == 0:
        return None
    score = acc / total_w
    if has_text:
        score = min(score, TEXT_GATE_CAP)
    return round(score, 2)


def _normalize(data: Any) -> dict[str, Any]:
    """Coerce a raw critic response into a stable critique dict with a score.

    Shared by the graph node and the eval harness so both score identically.
    ``score`` may be ``None`` when the model returned no usable axes.
    """
    out: dict[str, Any] = dict(data) if isinstance(data, dict) else {}
    has_text = bool(out.get("has_text"))
    out["has_text"] = has_text
    out.setdefault("axes", {})
    out.setdefault("issues", [])
    out.setdefault("fixes", [])
    # A flagged baked-in image must always carry a removal instruction so the
    # Reviser → Designer loop actually acts on it.
    if has_text and not any(
        "text" in str(f).lower() or "글자" in str(f) for f in out["fixes"]
    ):
        out["fixes"].insert(0, "remove all text, letters, numbers and watermarks from the image")
    out["score"] = aggregate(out["axes"], has_text)
    return out


def critique_image(image_b64: str, *, max_tokens: int = 900) -> dict[str, Any]:
    """Run the vision critic on one image → normalized critique dict.

    Reused by the eval harness so offline evaluation scores exactly as production
    does. Returns a critique whose ``score`` is ``None`` if the critic was
    unavailable (no key) or returned nothing usable.
    """
    return _normalize(vision_json(SYSTEM, RUBRIC, image_b64, max_tokens=max_tokens))


def art_director(state: AgentState) -> AgentState:
    thr = get_settings().quality_threshold
    img = state.get("card_image_b64")
    if not img:
        # Nothing rendered (no key / skipped) — pass through without blocking.
        return {
            "critique": {"score": thr, "axes": {}, "issues": [], "fixes": [], "note": "no image to review"},
            "score": thr,
        }
    crit = critique_image(img)
    score = crit.get("score")
    if score is None:
        # Critic unavailable or unparseable — don't block the loop, pass the gate.
        crit = {"score": thr, "axes": {}, "issues": [], "fixes": [], "note": "critic unavailable"}
        score = thr
    crit["score"] = score
    return {"critique": crit, "score": float(score)}
