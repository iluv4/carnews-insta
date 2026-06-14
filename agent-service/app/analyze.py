"""Reference analysis — read the Korean text and describe the layout of a card.

This is the "design DNA 분석" that feeds RAG: given a reference Instagram card,
it returns the verbatim Korean copy (OCR) plus a structured description of the
layout, so the retriever's summaries are grounded in what the card actually
shows instead of a guess.

It is a **perception** task (OCR + layout), not aesthetic taste, so an open VLM
is fully competitive. It runs on GPT-5.5 by default, but flips to **Qwen2.5-VL**
with zero code changes by setting the ``AGENT_ANALYZE_*`` env (an OpenAI-
compatible provider such as Together / OpenRouter / DashScope) — no GPU needed
on your side, so Railway stays CPU-only.
"""
from __future__ import annotations

from typing import Any

from .config import get_settings
from .models import vision_json

SYSTEM = (
    "You are a design analyst. Read ALL Korean (and any other) text in the image "
    "verbatim, and describe the visual layout precisely. Never invent text that "
    "is not actually visible. Output ONLY JSON."
)

PROMPT = (
    "이 레퍼런스 카드 이미지를 분석하라.\n"
    "1) text_blocks: 이미지에 실제로 보이는 모든 텍스트를 한국어 그대로 읽어라. 각 블록은 "
    "role(headline/subhead/body/caption/cta/badge 등), text, position(top-left·"
    "center·bottom 등 대략 위치), style(굵기/대략 크기/색)을 적는다.\n"
    "2) layout: grid(구역 분할 설명), alignment, color_palette(hex 3~5개 추정), "
    "background(배경 설명), typography(서체 인상)\n"
    "3) summary: 이 디자인의 'DNA'를 한 문장(한국어)으로 요약 — RAG 검색용\n"
    "보이지 않는 텍스트를 지어내지 말 것. 텍스트가 없으면 text_blocks는 빈 배열.\n"
    '반드시 이 JSON만 출력: {"text_blocks":[{"role":"...","text":"...","position":"...","style":"..."}],'
    '"layout":{"grid":"...","alignment":"...","color_palette":["#......"],"background":"...","typography":"..."},'
    '"summary":"..."}'
)


def analyze_reference(image_b64: str, *, max_tokens: int = 1200) -> dict[str, Any]:
    """Read Korean text + describe layout for one reference image.

    Returns ``{text_blocks, layout, summary, model, available}``. ``available``
    is ``False`` when no key is configured (dev / CI), so callers can fall back
    to a lexical summary instead of crashing.
    """
    s = get_settings()
    data = vision_json(
        SYSTEM,
        PROMPT,
        image_b64,
        max_tokens=max_tokens,
        model=s.analyze_model,
        base_url=s.analyze_base_url or None,
        api_key=s.analyze_key or None,
    )
    if not isinstance(data, dict) or not data:
        return {"text_blocks": [], "layout": {}, "summary": "", "model": s.analyze_model, "available": False}
    data.setdefault("text_blocks", [])
    data.setdefault("layout", {})
    # Backstop summary from the OCR'd headline if the model omitted one.
    if not data.get("summary"):
        head = next(
            (b.get("text") for b in data["text_blocks"] if isinstance(b, dict) and b.get("text")),
            "",
        )
        data["summary"] = head or ""
    data["model"] = s.analyze_model
    data["available"] = True
    return data
