"""Human-in-the-loop feedback: revision, collection, preference re-ranking.

Runs without any API key — exercises the fallback paths only.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app.feedback_store as fb  # noqa: E402
from app.graph import revise_with_feedback  # noqa: E402
from app.nodes.human_critic import human_critic  # noqa: E402


def _revise_state(**kw):
    base = {
        "topic": "제주도 흑돼지 맛집",
        "brand": "맛집로고",
        "examples": [{"template_id": "english_news_gpt", "score": 0.9, "summary": "editorial"}],
        "copy": {"slides": [{"role": "cover", "title": "흑돼지 맛집"}]},
        "render_image": True,
        "revision": 0,
        "revision_notes": [],
        "threshold": 8.0,
        "max_revisions": 2,
        "auto_score_before": 6.0,
        "human_feedback": {"score": 4.0, "notes": ["글자 더 크게", "대비 높이기"], "seconds": 12.0},
    }
    base.update(kw)
    return base


def test_human_critic_maps_feedback_to_critique():
    out = human_critic({"human_feedback": {"score": 5.5, "notes": ["a", " ", "b"]}})
    assert out["score"] == 5.5
    assert out["critique"]["source"] == "human"
    # blank notes dropped, real ones kept as fixes
    assert out["critique"]["fixes"] == ["a", "b"]


def test_revise_feeds_human_fixes_into_designer():
    result = revise_with_feedback(_revise_state())
    card = result["card"]
    assert result["human_score"] == 4.0
    assert result["auto_score_before"] == 6.0
    # a fresh image prompt was produced for the revised card
    assert card["image_prompt"]
    # the revision counter advanced (the human critique drove one pass)
    assert card["revisions"] == 1


def test_feedback_collection_and_preference(tmp_path, monkeypatch):
    log = tmp_path / "feedback.jsonl"
    monkeypatch.setenv("AGENT_FEEDBACK_LOG", str(log))

    fb.log_feedback({"template_ids": ["t_good"], "human_score": 9.0, "seconds": 5.0, "regenerations": 0})
    fb.log_feedback({"template_ids": ["t_good"], "human_score": 7.0, "seconds": 6.0, "regenerations": 1})
    fb.log_feedback({"template_ids": ["t_bad"], "human_score": 2.0})

    recs = fb.load_records()
    assert len(recs) == 3

    prefs = fb.preference_by_template()
    # mean(9,7)/10 = 0.8 for the liked template; 2/10 = 0.2 for the disliked one
    assert abs(prefs["t_good"] - 0.8) < 1e-6
    assert abs(prefs["t_bad"] - 0.2) < 1e-6

    # only records with a `seconds` field become edit-cost rows
    assert len(fb.edit_cost_records()) == 2

    s = fb.stats()
    assert s["count"] == 3
    assert s["top_templates"][0][0] == "t_good"


def test_score_correlation(tmp_path, monkeypatch):
    log = tmp_path / "feedback.jsonl"
    monkeypatch.setenv("AGENT_FEEDBACK_LOG", str(log))

    # auto and human scores that move together → strong positive correlation
    for a, h in [(2.0, 3.0), (5.0, 4.0), (7.0, 8.0), (9.0, 9.0)]:
        fb.log_feedback({"auto_score_before": a, "human_score": h})
    # a record missing the auto score must be ignored
    fb.log_feedback({"human_score": 5.0})

    corr = fb.score_correlation()
    assert corr["n"] == 4
    assert corr["pearson"] > 0.8
    assert corr["spearman"] > 0.8
    assert corr["mean_abs_error"] is not None


def test_preference_reranks_retrieval(tmp_path, monkeypatch):
    """A heavily-preferred template should climb the retrieval ranking."""
    from app.config import get_settings
    from app.nodes.retriever import retriever
    from app.rag.store import get_store

    get_settings.cache_clear()
    log = tmp_path / "feedback.jsonl"
    monkeypatch.setenv("AGENT_FEEDBACK_LOG", str(log))
    monkeypatch.setenv("AGENT_PREF_WEIGHT", "5.0")  # exaggerate so the boost dominates

    tid = get_store().docs[-1].template_id  # an unlikely top hit for the query below
    for _ in range(3):
        fb.log_feedback({"template_ids": [tid], "human_score": 10.0})

    examples = retriever({"topic": "여행 가이드"})["examples"]
    assert examples[0]["template_id"] == tid
    assert examples[0]["preference"] > 0
    get_settings.cache_clear()
