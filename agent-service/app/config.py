"""Central configuration for the agent service.

All model ids and tunables are env-overridable so we never hard-pin a model
that gets deprecated. Defaults reflect the strongest OpenAI models available
as of 2026-06: GPT-5.5 (a text+vision multimodal reasoning model, used for both
reasoning and the vision critic) and gpt-image-2 for full-card generation.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pydantic import BaseModel


class Settings(BaseModel):
    # --- OpenAI ---
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    # Reasoning / copywriting / planning model.
    text_model: str = os.getenv("AGENT_TEXT_MODEL", "gpt-5.5")
    # Vision model used by the Art Director critic. gpt-5.5 is multimodal and a
    # generation ahead of gpt-5.2 — the critic that gates the self-revision loop
    # should be at least as strong as the model producing the copy.
    vision_model: str = os.getenv("AGENT_VISION_MODEL", "gpt-5.5")
    # Full-card image generation (text baked into the image — user's choice).
    image_model: str = os.getenv("AGENT_IMAGE_MODEL", "gpt-image-2")
    image_size: str = os.getenv("AGENT_IMAGE_SIZE", "1024x1536")  # 2:3 card
    # gpt-image-2 quality: low|medium|high|auto. "high" runs the deepest
    # inference path → sharpest detail and best Korean text rendering.
    image_quality: str = os.getenv("AGENT_IMAGE_QUALITY", "high")
    # Reasoning effort for GPT-5 family text/vision calls: none|low|medium|high|
    # xhigh. Quality-first default "high" — more reasoning → better copy and a
    # sharper art-direction critique, at higher token cost.
    reasoning_effort: str = os.getenv("AGENT_REASONING_EFFORT", "high")
    embed_model: str = os.getenv("AGENT_EMBED_MODEL", "text-embedding-3-large")

    # --- RAG ---
    database_url: str = os.getenv("DATABASE_URL", "") or os.getenv(
        "DATABASE_POSTGRES_PRISMA_URL", ""
    )
    templates_dir: str = os.getenv(
        "AGENT_TEMPLATES_DIR",
        os.path.join(os.path.dirname(__file__), "..", "..", "src", "templates"),
    )
    rag_top_k: int = int(os.getenv("AGENT_RAG_TOP_K", "4"))
    # How strongly accumulated human preference re-ranks retrieval. The blended
    # score is `similarity + pref_weight * mean_human_score(0..1)`, so 0 disables
    # the human signal and larger values let well-liked templates surface more.
    pref_weight: float = float(os.getenv("AGENT_PREF_WEIGHT", "0.15"))

    # --- Agent loop ---
    # The Art Director critique → Reviser loop runs until the score clears the
    # threshold or we hit max_revisions. This is the core "self-improving" loop.
    quality_threshold: float = float(os.getenv("AGENT_QUALITY_THRESHOLD", "8.0"))
    max_revisions: int = int(os.getenv("AGENT_MAX_REVISIONS", "2"))

    @property
    def has_openai(self) -> bool:
        k = self.openai_api_key
        return bool(k) and k not in {"dummy_key", "your_openai_api_key_here"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
