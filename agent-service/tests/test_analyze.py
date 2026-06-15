"""Tests for reference analysis (read Korean text + describe layout).

No API key required — exercises the graceful no-key fallback so the endpoint and
ingestion path never crash in dev / CI.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.analyze import analyze_reference  # noqa: E402
from app.config import get_settings  # noqa: E402


def test_analyze_reference_graceful_without_key():
    out = analyze_reference("data:image/png;base64,deadbeef")
    assert out["available"] is False
    assert out["text_blocks"] == []
    assert out["layout"] == {}
    # Reports which model *would* be used, so callers can log/route on it.
    assert out["model"] == get_settings().analyze_model


def test_analyze_defaults_to_main_vision_model():
    # With no AGENT_ANALYZE_* overrides set, analysis reuses the vision model.
    s = get_settings()
    assert s.analyze_model == s.vision_model
    assert s.analyze_key == s.openai_api_key
