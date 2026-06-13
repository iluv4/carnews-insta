"""Smoke tests that run without any API key (exercise the fallback paths)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.graph import (  # noqa: E402
    run_linear,
    _route_after_critic,
    _review_decision,
    _HAS_LANGGRAPH,
)
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
    assert seen[:3] == ["planner", "retriever", "copywriter"]
    assert seen[-1] == "collect"
    assert len(state["plan"]) == 3
    assert len(state["examples"]) > 0
    assert state["image_prompt"]


def test_fan_out_renders_one_card_per_slide():
    state = _state(num_slides=4)
    seen = [name for name, _ in run_linear(state)]
    # One render_slide branch per slide, then a single fan-in.
    assert seen.count("render_slide") == 4
    assert seen.count("collect") == 1
    cards = state["final_cards"]
    assert len(cards) == 4
    # Branches fan back in ordered, and each slide got its own background prompt.
    assert [c["index"] for c in cards] == [0, 1, 2, 3]
    assert all(c["image_prompt"] for c in cards)


def test_rag_returns_templates():
    store = get_store()
    assert len(store.docs) >= 10
    hits = store.search("여행 가이드", top_k=3)
    assert len(hits) == 3


def test_critic_route_triggers_revision_when_below_threshold():
    assert _route_after_critic(_state(score=3.0, revision=0, max_revisions=2)) == "reviser"
    assert _route_after_critic(_state(score=9.0, revision=0, max_revisions=2)) == "done"
    assert _route_after_critic(_state(score=3.0, revision=2, max_revisions=2)) == "done"


def test_review_decision_routing():
    # Review off → always auto-approve (backward compatible).
    assert _review_decision({"review_enabled": False}) == "approve"
    # On + approve / on + revise with a target.
    assert _review_decision({"review_enabled": True, "review": {"action": "approve"}}) == "approve"
    assert (
        _review_decision({"review_enabled": True, "review": {"action": "revise", "slides": [1]}})
        == "revise"
    )
    assert (
        _review_decision({"review_enabled": True, "review": {"action": "revise", "notes": ["x"]}})
        == "revise"
    )
    # revise with nothing to change → no-op approve.
    assert _review_decision({"review_enabled": True, "review": {"action": "revise"}}) == "approve"


def test_human_in_the_loop_interrupt_resume():
    """End-to-end: pause for review, partially revise, then approve (needs langgraph)."""
    if not _HAS_LANGGRAPH:
        return
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

    from app.graph import build_graph

    g = build_graph(checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": "test-hitl"}}
    init = {**_state(num_slides=3), "review_enabled": True, "review": {}}

    chunks = list(g.stream(init, cfg, stream_mode="updates"))
    assert any("__interrupt__" in c for c in chunks)        # paused at the gate
    assert g.get_state(cfg).next == ("review_gate",)
    assert len(g.get_state(cfg).values["final_cards"]) == 3

    # Revise only slide 1 → re-renders that card, pauses for re-review.
    list(
        g.stream(
            Command(resume={"action": "revise", "slides": [1], "notes": ["배경 더 밝게"]}),
            cfg,
            stream_mode="updates",
        )
    )
    assert g.get_state(cfg).next == ("review_gate",)
    assert len(g.get_state(cfg).values["final_cards"]) == 3   # merged, not duplicated

    # Approve → run finishes.
    list(g.stream(Command(resume={"action": "approve"}), cfg, stream_mode="updates"))
    assert g.get_state(cfg).next == ()
