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
    """Art-director critique of the BAKED card. ``score`` is the weighted
    aggregate of ``axes`` (composition, readability, color_mood, cleanliness,
    text_quality), computed deterministically by
    ``app.nodes.art_director.aggregate``. ``garbled`` caps the score when the
    baked Korean glyphs look broken/misspelled (the OCR gate is the rigorous
    character-level check; this is the complementary visual gate)."""
    score: float
    axes: dict[str, AxisScore] = Field(default_factory=dict)
    garbled: bool = False
    issues: list[str] = Field(default_factory=list)
    fixes: list[str] = Field(default_factory=list)


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
    # The exact strings baked into the card, in reading order (the OCR target).
    intended_text: list[str]
    card_image_b64: Optional[str]
    # ocr gate (text-fidelity check on the baked card)
    ocr_text: str
    text_score: float
    text_issues: list[str]
    # art director critic
    critique: dict[str, Any]
    score: float
    # reviser loop bookkeeping (per render_slide branch)
    revision: int
    max_revisions: int
    threshold: float
    text_threshold: float
    revision_notes: list[str]
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
