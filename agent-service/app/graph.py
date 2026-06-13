"""LangGraph wiring.

    planner → retriever → copywriter ─┬─▶ render_slide ─┐
                                      ├─▶ render_slide ─┼─▶ collect ─▶ END
                                      └─▶ render_slide ─┘
                                       (one branch per slide, in parallel)

`copywriter` produces copy for every slide, then a **fan-out** dispatches one
`render_slide` branch per slide via LangGraph's `Send` API. Each branch runs the
full designer → image_gen → art_director → reviser self-correction loop for its
own card, independently and in parallel, so an N-slide deck costs roughly the
wall-clock time of a single card. `collect` fans the finished cards back in
(ordered) once every branch is done.

The per-card critique→revision cycle inside `render_slide` is still the point — a
real stateful loop, exactly what LangGraph is for — we now just run one per slide.
"""
from __future__ import annotations

from typing import Literal

from .config import get_settings
from .nodes import (
    art_director,
    copywriter,
    designer,
    image_gen,
    planner,
    retriever,
    reviser,
)
from .schemas import AgentState

try:
    from langgraph.graph import END, START, StateGraph

    try:  # Send moved across minor versions; support both.
        from langgraph.types import Send
    except Exception:  # pragma: no cover
        from langgraph.constants import Send
    _HAS_LANGGRAPH = True
except Exception:  # pragma: no cover - allows import without the dep installed
    _HAS_LANGGRAPH = False


def _route_after_critic(state: AgentState) -> Literal["reviser", "done"]:
    score = float(state.get("score", 0))
    revision = int(state.get("revision", 0))
    threshold = float(state.get("threshold", get_settings().quality_threshold))
    max_rev = int(state.get("max_revisions", get_settings().max_revisions))
    if score < threshold and revision < max_rev:
        return "reviser"
    return "done"


def _slide_seed(state: AgentState, index: int, slide: dict) -> AgentState:
    """Build the isolated working state handed to one render_slide branch.

    Each branch sees only its single slide (as the cover of a 1-slide `copy`), so
    the existing designer/critic nodes operate on it unchanged, plus the shared
    grounding (retrieved examples, brand) and a fresh revision counter.
    """
    s = get_settings()
    return {
        "index": index,
        "topic": state.get("topic", ""),
        "brand": state.get("brand"),
        "audience": state.get("audience"),
        "examples": state.get("examples", []),
        "copy": {"slides": [slide]},
        "render_image": state.get("render_image", True),
        "revision": 0,
        "revision_notes": [],
        "threshold": float(state.get("threshold", s.quality_threshold)),
        "max_revisions": int(state.get("max_revisions", s.max_revisions)),
    }


def render_slide(state: AgentState) -> AgentState:
    """One slide, start to finish: art-direct → render → critique → revise loop.

    Reuses the existing single-card nodes against this branch's local state and
    returns a one-item `cards` list, which the graph reducer concatenates with
    the other parallel branches.
    """
    sub: dict = dict(state)
    sub.update(designer(sub))
    sub.update(image_gen(sub))
    sub.update(art_director(sub))
    while _route_after_critic(sub) == "reviser":
        sub.update(reviser(sub))
        sub.update(designer(sub))  # re-art-direct with the critic's fixes
        sub.update(image_gen(sub))
        sub.update(art_director(sub))

    slide = (sub.get("copy", {}).get("slides") or [{}])[0]
    card = {
        "index": int(sub.get("index", 0)),
        "role": slide.get("role"),
        "copy": slide,
        "image_prompt": sub.get("image_prompt"),
        "design_brief": sub.get("design_brief", {}),
        "card_image_b64": sub.get("card_image_b64"),
        "critique": sub.get("critique", {}),
        "score": sub.get("score"),
        "revisions": int(sub.get("revision", 0)),
        "provider": sub.get("provider"),
    }
    return {"cards": [card]}


def collect(state: AgentState) -> AgentState:
    """Fan-in: order the finished cards and expose a cover-based single-card view.

    The cover (slide 0) fields mirror the old single-card response shape for
    backward compatibility, while `final_cards` carries the whole deck. The deck
    score is the *weakest* card, since a deck is only as strong as its worst slide.
    """
    cards = sorted(state.get("cards", []), key=lambda c: c.get("index", 0))
    cover = cards[0] if cards else {}
    scores = [c["score"] for c in cards if isinstance(c.get("score"), (int, float))]
    return {
        "final_cards": cards,
        "card_image_b64": cover.get("card_image_b64"),
        "image_prompt": cover.get("image_prompt"),
        "design_brief": cover.get("design_brief", {}),
        "critique": cover.get("critique", {}),
        "score": min(scores) if scores else None,
        "revision": max((int(c.get("revisions", 0)) for c in cards), default=0),
        "provider": cover.get("provider"),
    }


def _dispatch(state: AgentState):
    """Conditional edge → one Send per slide (the fan-out)."""
    slides = (state.get("copy", {}) or {}).get("slides") or []
    return [Send("render_slide", _slide_seed(state, i, s)) for i, s in enumerate(slides)]


def build_graph():
    if not _HAS_LANGGRAPH:
        raise RuntimeError("langgraph is not installed")
    g = StateGraph(AgentState)
    g.add_node("planner", planner)
    g.add_node("retriever", retriever)
    g.add_node("copywriter", copywriter)
    g.add_node("render_slide", render_slide)
    g.add_node("collect", collect)

    g.add_edge(START, "planner")
    g.add_edge("planner", "retriever")
    g.add_edge("retriever", "copywriter")
    g.add_conditional_edges("copywriter", _dispatch, ["render_slide"])
    g.add_edge("render_slide", "collect")
    g.add_edge("collect", END)
    return g.compile()


def run_linear(state: AgentState):
    """Dependency-free executor that yields (node_name, partial_state).

    Mirrors the graph — including the per-slide critic→reviser loop and the
    fan-out/fan-in — but runs the slides sequentially, so the service works even
    before `pip install langgraph` and tests can assert node order offline.
    """
    head = {"planner": planner, "retriever": retriever, "copywriter": copywriter}
    for name in ["planner", "retriever", "copywriter"]:
        partial = head[name](state)
        state.update(partial)
        yield name, partial

    slides = (state.get("copy", {}) or {}).get("slides") or []
    cards: list[dict] = []
    for i, slide in enumerate(slides):
        partial = render_slide(_slide_seed(state, i, slide))
        cards.extend(partial["cards"])
        yield "render_slide", partial

    state["cards"] = cards
    partial = collect(state)
    state.update(partial)
    yield "collect", partial
