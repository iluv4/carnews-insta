"""Art Director node — the vision critic that scores the finished card.

This is what turns a one-shot generator into a self-improving agent: the
rendered card is fed back to a vision model with a rubric, producing a numeric
score + concrete fixes that the Reviser turns into the next attempt.

We BAKE the Korean copy into the image, so the critic scores a *finished* card —
the text is supposed to be there. Rather than ask the model for one fuzzy
number, it grades five weighted design axes; the overall score is then
aggregated **deterministically in Python** — LLMs are unreliable at the
arithmetic, and a fixed formula makes the quality gate stable and explainable.

Text *correctness* (right characters, no missing digits) is the OCR gate's job
(``app.nodes.ocr_gate``); here ``garbled`` is the complementary *visual* gate —
if the baked glyphs look broken/melted/misspelled, the card is capped regardless
of how pretty the rest is, because a beautiful-but-garbled card is unpublishable.
"""
from __future__ import annotations

from typing import Any, Optional

from ..config import get_settings
from ..models import vision_json
from ..schemas import AgentState

SYSTEM = (
    "You are a meticulous art director reviewing a FINISHED Korean card-news "
    "card with the Korean copy baked into the image. Judge it as a publishable "
    "card. Output ONLY JSON."
)

# Per-axis weights (sum = 1.0). Tuned for a finished Korean card-news card where
# the text is baked in: legible, well-integrated typography matters as much as
# composition, and crisp (non-garbled) glyphs are non-negotiable for the product.
RUBRIC_WEIGHTS: dict[str, float] = {
    "composition": 0.25,   # 구도 / 시각적 위계 — 시선 흐름·균형·주제 강조
    "readability": 0.25,   # 텍스트 가독성 — 배경 대비·크기·배치
    "color_mood": 0.20,    # 색 · 무드의 매력과 주제 적합성
    "cleanliness": 0.15,   # 잡티 · 왜곡 · 비현실적 아티팩트 없음
    "text_quality": 0.15,  # 글자가 또렷하고 깨지지 않게 렌더됨 (시각적)
}

# Garbled/broken baked text is a hard product failure (the card can't ship), so
# when the critic flags it we cap the overall score regardless of the rest.
TEXT_GATE_CAP = 4.0

RUBRIC = (
    "이 '완성된' 카드뉴스 이미지를 아래 5개 축으로 각각 0~10점 채점하라 (글자는 이미지에 "
    "이미 박혀 있어야 정상이다).\n"
    "1) composition(구도/위계): 시선 흐름·균형·주제 강조가 좋은가\n"
    "2) readability(가독성): 박힌 한국어 텍스트가 배경과 충분히 대비되고 크기·배치가 읽기 좋은가\n"
    "3) color_mood(색·무드): 팔레트의 매력과 주제 적합성, 분위기\n"
    "4) cleanliness(완성도): 잡티·왜곡·이상한 아티팩트·비현실적 형태가 없는가\n"
    "5) text_quality(글자품질): 한글 글자가 또렷하고 깨지거나 녹거나 오타처럼 보이지 않는가 "
    "(깨져 보이면 0~2점으로 주고 garbled=true)\n"
    "각 축마다 점수와 한 줄 코멘트를 달아라. issues는 구체적 문제, fixes는 다음 이미지 "
    "생성 프롬프트에 그대로 넣을 수 있는 영어 수정 지시문으로 적어라.\n"
    '반드시 이 JSON만 출력: {"axes":{'
    '"composition":{"score":0-10,"comment":"..."},'
    '"readability":{"score":0-10,"comment":"..."},'
    '"color_mood":{"score":0-10,"comment":"..."},'
    '"cleanliness":{"score":0-10,"comment":"..."},'
    '"text_quality":{"score":0-10,"comment":"..."}},'
    '"garbled":true|false,"issues":["..."],"fixes":["..."]}'
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


def aggregate(axes: Any, garbled: bool) -> Optional[float]:
    """Weighted 0–10 score from the per-axis rubric — pure and deterministic.

    Missing/invalid axes are dropped and the remaining weights renormalised, so
    a partial critic response still yields a sensible score. Returns ``None``
    when no axis is usable (caller decides how to fall back). Garbled baked text
    caps the score at :data:`TEXT_GATE_CAP`.
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
    if garbled:
        score = min(score, TEXT_GATE_CAP)
    return round(score, 2)


def _normalize(data: Any) -> dict[str, Any]:
    """Coerce a raw critic response into a stable critique dict with a score.

    Shared by the graph node and the eval harness so both score identically.
    ``score`` may be ``None`` when the model returned no usable axes.
    """
    out: dict[str, Any] = dict(data) if isinstance(data, dict) else {}
    garbled = bool(out.get("garbled"))
    out["garbled"] = garbled
    out.setdefault("axes", {})
    out.setdefault("issues", [])
    out.setdefault("fixes", [])
    # A flagged garbled card must always carry a re-render instruction so the
    # Reviser → Designer loop actually acts on it.
    if garbled and not any(
        "text" in str(f).lower() or "글자" in str(f) or "glyph" in str(f).lower()
        for f in out["fixes"]
    ):
        out["fixes"].insert(
            0, "re-render the Korean text crisply and legibly with no garbled or melted glyphs"
        )
    out["score"] = aggregate(out["axes"], garbled)
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
