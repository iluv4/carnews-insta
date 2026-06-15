"""Request/response models and the shared LangGraph state."""
from __future__ import annotations

import operator
from typing import Annotated, Any, Optional, TypedDict
from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    topic: str = Field(..., description="What the card news is about, in Korean or English.")
    num_slides: int = Field(3, ge=1, le=8)
    brand: Optional[str] = Field(None, description="Optional brand mark text.")
    audience: Optional[str] = Field(None, description="Optional target audience hint.")
    # When false, callers get the design brief + copy but no image bytes
    # (useful for fast previews / when no image quota).
    render_image: bool = True


class AnalyzeRequest(BaseModel):
    image: str = Field(..., description="Reference card image as base64 or a data URL.")


class SlidePlan(BaseModel):
    role: str  # cover | review | menu | cta | info | closing
    intent: str


class RetrievedExample(BaseModel):
    template_id: str
    score: float
    summary: str


class AxisScore(BaseModel):
    """One axis of the art-director rubric (0–10) with a one-line comment."""
    score: float
    comment: str = ""


class Critique(BaseModel):
    """Art-director critique. ``score`` is the weighted aggregate of ``axes``
    (composition, overlay_space, color_mood, cleanliness, text_free), computed
    deterministically by ``app.nodes.art_director.aggregate``."""
    score: float
    axes: dict[str, AxisScore] = Field(default_factory=dict)
    has_text: bool = False
    issues: list[str] = Field(default_factory=list)
    fixes: list[str] = Field(default_factory=list)


class HumanFeedback(BaseModel):
    """A human's evaluation of a rendered card — the manual counterpart to the
    Art Director's automated critique. Same shape the reviser already consumes
    (a score + free-text fixes), so it slots into the existing revision loop."""
    score: float = Field(..., ge=0, le=10, description="Human quality score, 0-10.")
    notes: list[str] = Field(default_factory=list, description="Concrete fixes the human wants.")
    seconds: Optional[float] = Field(None, description="Time the human spent reviewing/editing (edit-cost metric).")


class ReviseRequest(BaseModel):
    """Re-render one card guided by human feedback (human-in-the-loop revision)."""
    topic: str
    brand: Optional[str] = None
    audience: Optional[str] = None
    # The card's copy slide (role/title/body…) being revised.
    slide: dict[str, Any] = Field(default_factory=dict)
    # The retrieved exemplars used for this card — carries template_ids so the
    # human score can be attributed back to templates for preference learning.
    examples: list[dict[str, Any]] = Field(default_factory=list)
    design_brief: dict[str, Any] = Field(default_factory=dict)
    image_prompt: Optional[str] = None
    auto_score_before: Optional[float] = Field(None, description="Art Director score before this revision.")
    render_image: bool = True
    feedback: HumanFeedback


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
    # budgeter (Test-Time Scaling: difficulty → inference budget)
    difficulty: float
    n_samples: int
    budget: dict[str, Any]
    # retriever (RAG)
    examples: list[dict[str, Any]]
    # copywriter (Best-of-N self-consistency diagnostics)
    copy: dict[str, Any]
    copy_reward: float
    copy_candidates: int
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
    # human-in-the-loop: a person's critique, injected in place of (or alongside)
    # the Art Director's. Carries the same {score, fixes} contract the reviser reads.
    human_feedback: dict[str, Any]
    # fan-out: which slide this branch is rendering
    index: int
    # Per-slide outputs accumulated from the parallel render_slide branches.
    # operator.add is the LangGraph reducer that concatenates each branch's
    # one-item list into the shared state instead of overwriting it.
    cards: Annotated[list[dict[str, Any]], operator.add]
    # `collect` writes the index-sorted, finished deck here.
    final_cards: list[dict[str, Any]]
    # diagnostics
    provider: str
    error: Optional[str]
