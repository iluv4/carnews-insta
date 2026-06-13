"""LangGraph wiring.

    planner → retriever → copywriter → designer → image_gen → ocr_gate → art_director
                                          ▲                                     │
                                          └────────────── reviser ◄─────────────┘   (loop)
                                                             │
                                                            END  (score ok / max revisions)

The cycle (art_director → reviser → designer → …) is the whole point: a real
stateful graph with a feedback loop, which is exactly what LangGraph is for and
what a plain forward-pass pipeline can't express cleanly.

Because the Korean copy is baked into the image, the loop now gates on TWO
signals: the ``ocr_gate`` node's text-fidelity score (did the glyphs render
correctly?) and the ``art_director``'s aesthetic score. Either falling short
sends the card back for a re-render.
"""
from __future__ import annotations

from typing import Literal

from .config import get_settings
from .nodes import (
    art_director,
    copywriter,
    designer,
    image_gen,
    ocr_gate,
    planner,
    retriever,
    reviser,
)
from .schemas import AgentState

try:
    from langgraph.graph import END, START, StateGraph
    _HAS_LANGGRAPH = True
except Exception:  # pragma: no cover - allows import without the dep installed
    _HAS_LANGGRAPH = False


def _route_after_critic(state: AgentState) -> Literal["reviser", "done"]:
    s = get_settings()
    score = float(state.get("score", 0))
    text_score = float(state.get("text_score", s.text_threshold))
    revision = int(state.get("revision", 0))
    threshold = float(state.get("threshold", s.quality_threshold))
    text_threshold = float(state.get("text_threshold", s.text_threshold))
    max_rev = int(state.get("max_revisions", s.max_revisions))
    # Re-render if the card fails EITHER the aesthetic bar or the baked-text bar.
    below_bar = score < threshold or text_score < text_threshold
    if below_bar and revision < max_rev:
        return "reviser"
    return "done"


def build_graph():
    if not _HAS_LANGGRAPH:
        raise RuntimeError("langgraph is not installed")
    g = StateGraph(AgentState)
    g.add_node("planner", planner)
    g.add_node("retriever", retriever)
    g.add_node("copywriter", copywriter)
    g.add_node("designer", designer)
    g.add_node("image_gen", image_gen)
    g.add_node("ocr_gate", ocr_gate)
    g.add_node("art_director", art_director)
    g.add_node("reviser", reviser)

    g.add_edge(START, "planner")
    g.add_edge("planner", "retriever")
    g.add_edge("retriever", "copywriter")
    g.add_edge("copywriter", "designer")
    g.add_edge("designer", "image_gen")
    g.add_edge("image_gen", "ocr_gate")
    g.add_edge("ocr_gate", "art_director")
    g.add_conditional_edges(
        "art_director",
        _route_after_critic,
        {"reviser": "reviser", "done": END},
    )
    g.add_edge("reviser", "designer")  # loop back with revision notes
    return g.compile()


# Ordered node sequence used by the linear fallback runner (no langgraph).
_LINEAR = [planner, retriever, copywriter, designer, image_gen, ocr_gate, art_director]


def run_linear(state: AgentState):
    """Dependency-free executor that yields (node_name, partial_state).

    Mirrors the graph (including the critic→reviser loop) so the service works
    even before `pip install langgraph`, and so tests can assert node order.
    """
    funcs = {f.__name__: f for f in _LINEAR + [reviser]}
    seq = ["planner", "retriever", "copywriter", "designer", "image_gen", "ocr_gate", "art_director"]
    for name in seq:
        partial = funcs[name](state)
        state.update(partial)
        yield name, partial
    # critique loop
    while _route_after_critic(state) == "reviser":
        for name in ["reviser", "designer", "image_gen", "ocr_gate", "art_director"]:
            partial = funcs[name](state)
            state.update(partial)
            yield name, partial
