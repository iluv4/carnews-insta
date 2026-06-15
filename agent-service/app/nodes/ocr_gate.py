"""OCR gate node — the text-fidelity check that makes "박기 올인" safe.

Baking Korean copy into the image is only publishable if the glyphs are
actually correct. This node is the safety net the bake-in strategy depends on:

  1. OCR  — a vision model transcribes the text it literally SEES in the
            rendered card (no guessing, no autocorrect).
  2. DIFF — we compare that transcription against the intended copy with a
            deterministic string diff (stdlib ``difflib``), producing a
            0–10 ``text_score``.
  3. GATE — numbers / dates / URLs are unforgiving: a single wrong digit caps
            the score, because "almost right" contact info is worse than none.

A low score loops back through the reviser → designer for a re-render, exactly
like the art-director critique. Together they make the graph self-correct on
*both* aesthetics and text correctness. Degrades gracefully (passes through)
when there's no API key or nothing was rendered, so dev/CI still run offline.

This is the deterministic-diff MVP of the gate; the production upgrade swaps the
VLM transcription for a dedicated OCR engine and adds per-token weighting.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

from ..config import get_settings
from ..models import vision_json
from ..schemas import AgentState

SYSTEM = (
    "You are an OCR engine. Transcribe ONLY the text you can literally see in the "
    "image, exactly as rendered — do not guess, translate, autocorrect, or invent "
    "characters. Garbled glyphs should be transcribed as the garbled characters you "
    "see. Output ONLY JSON."
)
PROMPT = '이미지에 보이는 모든 글자를 보이는 그대로 옮겨 적어라. 반드시 이 JSON: {"lines":["...","..."]}'

# Tokens that must match character-for-character (numbers, dates, prices, URLs,
# phone numbers, @handles). One wrong character here = hard fail.
_CRITICAL = re.compile(r"[0-9]+(?:[.,:/\-]+[0-9]+)*|https?://\S+|www\.\S+|@\w+|[\w.+-]+@[\w.-]+")
_WS = re.compile(r"\s+")


def _norm(s: str) -> str:
    return _WS.sub("", s).lower()


def _critical_tokens(lines: list[str]) -> list[str]:
    return _CRITICAL.findall(" ".join(lines))


def ocr_gate(state: AgentState) -> AgentState:
    thr = get_settings().text_threshold
    intended = state.get("intended_text", []) or []
    img = state.get("card_image_b64")

    # Nothing to check (no render / no key / no intended text) → don't block.
    if not img or not intended:
        return {"ocr_text": "", "text_score": thr, "text_issues": []}

    data = vision_json(SYSTEM, PROMPT, img, max_tokens=600)
    if not isinstance(data, dict) or "lines" not in data:
        # OCR unavailable — fail open so we don't loop forever on a dead critic.
        return {"ocr_text": "", "text_score": thr, "text_issues": ["ocr unavailable"]}

    ocr_lines = [str(x) for x in (data.get("lines") or [])]
    ocr_text = "\n".join(ocr_lines)

    want = _norm("\n".join(intended))
    got = _norm(ocr_text)
    ratio = SequenceMatcher(None, want, got).ratio() if want else 1.0
    score = round(ratio * 10, 2)

    issues: list[str] = []
    # Hard gate: every critical token in the intended copy must appear verbatim.
    got_raw = _norm(ocr_text)
    for tok in _critical_tokens(intended):
        if _norm(tok) not in got_raw:
            issues.append(f"숫자/날짜/연락처 불일치: '{tok}' 가 카드에서 안 보이거나 깨짐")
            score = min(score, 4.0)

    if score < thr and not issues:
        issues.append(f"텍스트 정확도 {score}/10 — 글자 깨짐/오타 의심, 카피 그대로 다시 렌더")

    return {"ocr_text": ocr_text, "text_score": score, "text_issues": issues}
