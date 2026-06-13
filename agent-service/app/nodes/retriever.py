"""Retriever node — the RAG step.

Embeds the topic and pulls the most similar real templates from the store so
downstream nodes are grounded in human-made designs, not the model's prior.
"""
from __future__ import annotations

from ..rag.store import get_store
from ..schemas import AgentState


def retriever(state: AgentState) -> AgentState:
    topic = state.get("topic", "")
    audience = state.get("audience") or ""
    query = f"{topic} {audience}".strip()
    hits = get_store().search(query)
    examples = [
        {
            "template_id": doc.template_id,
            "score": round(float(score), 4),
            "summary": doc.summary,
        }
        for doc, score in hits
    ]
    return {"examples": examples}
