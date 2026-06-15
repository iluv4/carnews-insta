"""Smoke tests that run without any API key (exercise the fallback paths)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.graph import run_linear, _route_after_critic  # noqa: E402
from app.rag.store import get_store  # noqa: E402
from app.tts import (  # noqa: E402
    budget_for,
    estimate_difficulty,
    score_copy,
    self_consistency,
)


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
    assert seen[:4] == ["planner", "budgeter", "retriever", "copywriter"]
    assert seen[-1] == "collect"
    assert len(state["plan"]) == 3
    assert len(state["examples"]) > 0
    assert state["image_prompt"]
    # Budget forcing populated an inference budget for this run.
    assert state["n_samples"] >= 1
    assert 0.0 <= state["difficulty"] <= 1.0
    # Best-of-N selected a candidate and recorded how many it scored.
    assert state["copy_candidates"] == state["n_samples"]


def test_self_consistency_picks_highest_reward():
    # generate(i) -> i ; reward = -(i-2)^2 peaks at i == 2.
    best, best_r, scores = self_consistency(lambda i: i, lambda c: -((c - 2) ** 2), n=5)
    assert best == 2
    assert best_r == 0
    assert len(scores) == 5


def test_score_copy_prefers_complete_copy():
    good = [{"title": "제주 흑돼지", "bullets": ["😍 육즙", "😎 가성비"], "footer": "팔로우"}]
    weak = [{"title": "", "bullets": [], "footer": ""}]
    assert score_copy("제주도 맛집", good) > score_copy("제주도 맛집", weak)


def test_budget_forcing_scales_with_difficulty():
    easy = budget_for(0.0)
    hard = budget_for(1.0)
    assert hard["n_samples"] >= easy["n_samples"]
    assert hard["max_revisions"] >= easy["max_revisions"]
    # A long, technical topic is rated harder than a short plain one.
    assert estimate_difficulty("BMW M5 2026 0-100 가속 7단 DCT 토크 스펙 비교") >= estimate_difficulty("커피")


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
