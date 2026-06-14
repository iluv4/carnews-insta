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


def _client(base_url: Optional[str] = None, api_key: Optional[str] = None) -> Optional["OpenAI"]:
    """Build an OpenAI(-compatible) client. ``base_url`` lets calls target an
    OpenAI-compatible provider (e.g. Together / OpenRouter for Qwen3-VL); both
    args fall back to the configured defaults."""
    if OpenAI is None:
        return None
    s = get_settings()
    key = api_key or s.openai_api_key
    if not key or key in {"dummy_key", "your_openai_api_key_here"}:
        return None
    kwargs: dict[str, Any] = {"api_key": key}
    url = base_url or s.openai_base_url
    if url:
        kwargs["base_url"] = url
    return OpenAI(**kwargs)


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


def chat_json(system: str, user: str, *, max_tokens: int = 1200) -> dict[str, Any]:
    """Reasoning/text call that returns parsed JSON. Returns {} on failure."""
    client = _client()
    if client is None:
        return {}
    s = get_settings()
    try:
        res = client.chat.completions.create(
            model=s.text_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            **_reasoning_params(s.text_model, max_tokens),
        )
        return json.loads(res.choices[0].message.content or "{}")
    except Exception:
        return {}


def vision_json(
    system: str,
    prompt: str,
    image_b64: str,
    *,
    max_tokens: int = 800,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> dict[str, Any]:
    """Vision call returning parsed JSON. `image_b64` is a data URL or base64.

    ``model``/``base_url``/``api_key`` override the defaults so a single call can
    target a different (e.g. open, OpenAI-compatible) VLM such as Qwen3-VL.
    """
    client = _client(base_url=base_url, api_key=api_key)
    if client is None:
        return {}
    s = get_settings()
    mdl = model or s.vision_model
    url = image_b64 if image_b64.startswith("data:") else f"data:image/png;base64,{image_b64}"
    try:
        res = client.chat.completions.create(
            model=mdl,
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
            **_reasoning_params(mdl, max_tokens),
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
