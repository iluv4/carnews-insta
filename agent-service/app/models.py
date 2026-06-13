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
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
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
            max_tokens=max_tokens,
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
