"""Request/response models and the shared LangGraph state."""
from __future__ import annotations

from typing import Any, Optional, TypedDict
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
    # designer
    design_brief: dict[str, Any]
    image_prompt: str
    # image generation
    card_image_b64: Optional[str]
    # art director critic
    critique: dict[str, Any]
    score: float
    # reviser loop bookkeeping
    revision: int
    max_revisions: int
    threshold: float
    revision_notes: list[str]
    # diagnostics
    provider: str
    error: Optional[str]
