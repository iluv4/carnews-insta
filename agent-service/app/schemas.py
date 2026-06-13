"""Request/response models and the shared LangGraph state."""
from __future__ import annotations

from typing import Annotated, Any, Optional, TypedDict
from pydantic import BaseModel, Field


def merge_cards(left: list[dict], right: list[dict]) -> list[dict]:
    """LangGraph reducer for the per-slide `cards` accumulator.

    Merges by slide `index` (last write wins) instead of blindly concatenating,
    so the initial fan-out *and* a later partial re-render both work: re-rendering
    slide 1 replaces that one card in place rather than appending a duplicate.
    """
    by_index: dict[int, dict] = {c.get("index", 0): c for c in (left or [])}
    for c in right or []:
        by_index[c.get("index", 0)] = c
    return [by_index[k] for k in sorted(by_index)]


class GenerateRequest(BaseModel):
    topic: str = Field(..., description="What the card news is about, in Korean or English.")
    num_slides: int = Field(3, ge=1, le=8)
    brand: Optional[str] = Field(None, description="Optional brand mark text.")
    audience: Optional[str] = Field(None, description="Optional target audience hint.")
    # When false, callers get the design brief + copy but no image bytes
    # (useful for fast previews / when no image quota).
    render_image: bool = True
    # Opt-in human-in-the-loop: when true the graph pauses at a review gate after
    # the deck is rendered and waits for a /resume decision (approve or revise).
    review: bool = False


class ResumeRequest(BaseModel):
    """Resume a paused (interrupted) run with the reviewer's decision.

    decision = {"action": "approve"}                       → finish
             | {"action": "revise", "notes": [...],        → re-render some slides
                "slides": [0, 2]}   # omit slides = all
    """
    thread_id: str
    decision: dict[str, Any] = Field(default_factory=dict)


class SlidePlan(BaseModel):
    role: str  # cover | review | menu | cta | info | closing
    intent: str


class RetrievedExample(BaseModel):
    template_id: str
    score: float
    summary: str


class Critique(BaseModel):
    score: float
    readability: str
    hierarchy: str
    typography: str
    brand_consistency: str
    issues: list[str] = []
    fixes: list[str] = []


class AgentState(TypedDict, total=False):
    """Mutable state threaded through every node of the LangGraph."""
    # inputs
    topic: str
    num_slides: int
    brand: Optional[str]
    audience: Optional[str]
    render_image: bool
    # planner
    plan: list[dict[str, Any]]
    # retriever (RAG)
    examples: list[dict[str, Any]]
    # copywriter
    copy: dict[str, Any]
    # designer / image / critic — these hold the *current slide's* working values
    # (a single card during a render_slide fan-out branch, or the cover for the
    # backward-compatible single-card view exposed by `collect`).
    design_brief: dict[str, Any]
    image_prompt: str
    card_image_b64: Optional[str]
    critique: dict[str, Any]
    score: float
    # reviser loop bookkeeping (per render_slide branch)
    revision: int
    max_revisions: int
    threshold: float
    revision_notes: list[str]
    # fan-out: which slide this branch is rendering
    index: int
    # Per-slide outputs accumulated from the parallel render_slide branches.
    # `merge_cards` is the LangGraph reducer that merges each branch's one-item
    # list by slide index (last write wins) — so a partial re-render replaces
    # just those cards instead of duplicating them.
    cards: Annotated[list[dict[str, Any]], merge_cards]
    # `collect` writes the index-sorted, finished deck here.
    final_cards: list[dict[str, Any]]
    # human-in-the-loop review gate
    review_enabled: bool
    review: dict[str, Any]
    # diagnostics
    provider: str
    error: Optional[str]
