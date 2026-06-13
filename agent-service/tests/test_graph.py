"""Smoke tests that run without any API key (exercise the fallback paths)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.graph import run_linear, _route_after_critic  # noqa: E402
from app.rag.store import get_store  # noqa: E402


def _state(**kw):
    base = {
        "topic": "제주도 흑돼지 맛집",
        "num_slides": 3,
        "revision": 0,
        "revision_notes": [],
        "max_revisions": 2,
        "threshold": 8.0,
        "render_image": True,
    }
    base.update(kw)
    return base


def test_pipeline_runs_all_nodes():
    state = _state()
    seen = [name for name, _ in run_linear(state)]
    assert seen[:7] == [
        "planner", "retriever", "copywriter", "designer", "image_gen", "ocr_gate", "art_director",
    ]
    assert len(state["plan"]) == 3
    assert len(state["examples"]) > 0
    assert state["image_prompt"]
    # Baked-text pivot: the designer now names the exact strings to render, and
    # the ocr_gate exposes a text-fidelity score.
    assert state["intended_text"]
    assert "text_score" in state


def test_ocr_gate_diffs_against_intended_text():
    from app.nodes.ocr_gate import ocr_gate

    # No image / no key → fails open (doesn't block the loop).
    out = ocr_gate({"intended_text": ["제주도 흑돼지"], "card_image_b64": None})
    assert out["text_score"] >= 9.0


def test_rag_returns_templates():
    store = get_store()
    assert len(store.docs) >= 10
    hits = store.search("여행 가이드", top_k=3)
    assert len(hits) == 3


def test_critic_route_triggers_revision_when_below_threshold():
    assert _route_after_critic(_state(score=3.0, revision=0, max_revisions=2)) == "reviser"
    assert _route_after_critic(_state(score=9.0, revision=0, max_revisions=2)) == "done"
    assert _route_after_critic(_state(score=3.0, revision=2, max_revisions=2)) == "done"
