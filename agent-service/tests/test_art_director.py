"""Unit tests for the Art Director critic's deterministic scoring + gating.

These run without an API key — they exercise the pure aggregation logic that
gates the self-revision loop, so a regression here is caught in CI.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.nodes.art_director import (  # noqa: E402
    RUBRIC_WEIGHTS,
    TEXT_GATE_CAP,
    _normalize,
    aggregate,
    art_director,
)


def _axes(value):
    return {k: {"score": value, "comment": ""} for k in RUBRIC_WEIGHTS}


def test_weights_sum_to_one():
    assert abs(sum(RUBRIC_WEIGHTS.values()) - 1.0) < 1e-9


def test_uniform_axes_average_to_that_value():
    assert aggregate(_axes(8), has_text=False) == 8.0
    assert aggregate(_axes(10), has_text=False) == 10.0


def test_empty_axes_returns_none():
    assert aggregate({}, has_text=False) is None


def test_partial_axes_renormalise():
    # Only one axis present → its score regardless of its weight.
    assert aggregate({"composition": {"score": 7}}, has_text=False) == 7.0


def test_text_gate_caps_score():
    # A visually perfect image still fails the gate if text is baked in.
    assert aggregate(_axes(10), has_text=True) == TEXT_GATE_CAP


def test_scores_are_clamped():
    assert aggregate({k: {"score": 99} for k in RUBRIC_WEIGHTS}, has_text=False) == 10.0
    assert aggregate({k: {"score": -5} for k in RUBRIC_WEIGHTS}, has_text=False) == 0.0


def test_normalize_injects_remove_text_fix_when_flagged():
    crit = _normalize({"axes": _axes(9), "has_text": True, "fixes": []})
    assert crit["has_text"] is True
    assert any("text" in f.lower() for f in crit["fixes"])
    assert crit["score"] == TEXT_GATE_CAP


def test_node_passes_gate_when_no_image():
    # Dev / no-key path must not block the graph.
    out = art_director({"card_image_b64": None})
    assert isinstance(out["score"], float)
    assert "critique" in out
