"""Thin wrappers around the OpenAI SDK.

Every call degrades gracefully when no API key is configured so the graph can
run end-to-end in dev / CI with deterministic stub output (mirrors the
`hasKey()` fallback pattern already used in the Next.js routes).
"""
from __future__ import annotations

import base64
import json
from typing import Any, Optional

from .config import get_settings

try:  # openai is optional at import time so the module loads in CI
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


def _client() -> Optional["OpenAI"]:
    s = get_settings()
    if not s.has_openai or OpenAI is None:
        return None
    return OpenAI(api_key=s.openai_api_key)


def _is_reasoning(model: str) -> bool:
    """GPT-5 family / o-series are reasoning models with different param rules."""
    m = model.lower()
    return m.startswith("gpt-5") or (len(m) > 1 and m[0] == "o" and m[1].isdigit())


def _reasoning_params(model: str, max_tokens: int) -> dict[str, Any]:
    """Emit the model-appropriate output-budget + reasoning params.

    Reasoning models reject ``max_tokens`` (must use ``max_completion_tokens``)
    and spend part of that budget on hidden reasoning tokens, so they get
    headroom on top of the visible output we actually want, plus the configured
    reasoning effort (quality-first default "high").
    """
    if _is_reasoning(model):
        return {
            "max_completion_tokens": max(max_tokens + 2048, 4096),
            "reasoning_effort": get_settings().reasoning_effort,
        }
    return {"max_tokens": max_tokens}


def chat_json(
    system: str,
    user: str,
    *,
    max_tokens: int = 1200,
    temperature: Optional[float] = None,
) -> dict[str, Any]:
    """Reasoning/text call that returns parsed JSON. Returns {} on failure.

    ``temperature`` drives Best-of-N candidate diversity (see app/tts.py). It is
    only sent to non-reasoning models — GPT-5 / o-series reject the param and
    sample their own variation across calls anyway.
    """
    client = _client()
    if client is None:
        return {}
    s = get_settings()
    params = _reasoning_params(s.text_model, max_tokens)
    if temperature is not None and not _is_reasoning(s.text_model):
        params["temperature"] = temperature
    try:
        res = client.chat.completions.create(
            model=s.text_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            **params,
        )
        return json.loads(res.choices[0].message.content or "{}")
    except Exception:
        return {}


def vision_json(system: str, prompt: str, image_b64: str, *, max_tokens: int = 800) -> dict[str, Any]:
    """Vision critique call. `image_b64` is a data URL or base64 payload."""
    client = _client()
    if client is None:
        return {}
    s = get_settings()
    url = image_b64 if image_b64.startswith("data:") else f"data:image/png;base64,{image_b64}"
    try:
        res = client.chat.completions.create(
            model=s.vision_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": url}},
                    ],
                },
            ],
            **_reasoning_params(s.vision_model, max_tokens),
        )
        return json.loads(res.choices[0].message.content or "{}")
    except Exception:
        return {}


def generate_card_image(prompt: str) -> Optional[str]:
    """Full-card generation via gpt-image-2. Returns base64 PNG or None."""
    client = _client()
    if client is None:
        return None
    s = get_settings()
    try:
        res = client.images.generate(
            model=s.image_model,
            prompt=prompt,
            size=s.image_size,
            quality=s.image_quality,
            n=1,
        )
        data = res.data[0]
        b64 = getattr(data, "b64_json", None)
        if b64:
            return b64
        # Some snapshots return a URL instead of inline bytes.
        url = getattr(data, "url", None)
        if url:
            import urllib.request

            with urllib.request.urlopen(url) as r:  # noqa: S310
                return base64.b64encode(r.read()).decode()
    except Exception:
        return None
    return None


def embed(texts: list[str]) -> list[list[float]]:
    """Batch embeddings. Returns [] when no key (caller falls back to lexical)."""
    client = _client()
    if client is None or not texts:
        return []
    s = get_settings()
    try:
        res = client.embeddings.create(model=s.embed_model, input=texts)
        return [d.embedding for d in res.data]
    except Exception:
        return []
