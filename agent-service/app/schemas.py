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
    # operator.add is the LangGraph reducer that concatenates each branch's
    # one-item list into the shared state instead of overwriting it.
    cards: Annotated[list[dict[str, Any]], operator.add]
    # `collect` writes the index-sorted, finished deck here.
    final_cards: list[dict[str, Any]]
    # diagnostics
    provider: str
    error: Optional[str]
