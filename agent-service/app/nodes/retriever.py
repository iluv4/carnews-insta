"""Retriever node — the RAG step.

Embeds the topic and pulls the most similar real templates from the store so
downstream nodes are grounded in human-made designs, not the model's prior.

It also closes the human-feedback loop on the *input* side: templates that people
rated highly get a preference boost, so accumulated human evaluation steers which
designs surface in future generations (not just the one card being revised).
"""
from __future__ import annotations

from ..config import get_settings
from ..feedback_store import preference_by_template
from ..rag.store import get_store
from ..schemas import AgentState


def retriever(state: AgentState) -> AgentState:
    s = get_settings()
    topic = state.get("topic", "")
    audience = state.get("audience") or ""
    query = f"{topic} {audience}".strip()
    k = s.rag_top_k
    store = get_store()
    prefs = preference_by_template() if s.pref_weight else {}

    # When human preference is active, re-rank the whole corpus so a well-liked
    # template can surface even from a low similarity rank; otherwise just
    # over-fetch a small candidate pool. Either way we blend, then take top-k.
    pool = len(store.docs) if prefs else max(k * 3, k)
    candidates = store.search(query, top_k=pool)

    def blended(item: tuple) -> float:
        doc, score = item
        return float(score) + s.pref_weight * prefs.get(doc.template_id, 0.0)

    ranked = sorted(candidates, key=blended, reverse=True)[:k]
    examples = [
        {
            "template_id": doc.template_id,
            "score": round(float(score), 4),
            "preference": round(prefs.get(doc.template_id, 0.0), 4),
            "summary": doc.summary,
        }
        for doc, score in ranked
    ]
    return {"examples": examples}
