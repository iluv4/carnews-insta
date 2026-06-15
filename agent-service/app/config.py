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
    # inference path (best Korean detail) BUT can take 100-200s+ per image —
    # too slow for the synchronous /generate request once the revision loop
    # re-renders. "medium" is the sane default that actually completes; bump to
    # "high" only with an async/job pipeline (or a much longer route timeout).
    image_quality: str = os.getenv("AGENT_IMAGE_QUALITY", "medium")
    # Reasoning effort for GPT-5 family text/vision calls: none|low|medium|high|
    # xhigh. "high" = sharper copy/critique at higher latency. Text/vision calls
    # are far cheaper latency-wise than image gen, so this stays high.
    reasoning_effort: str = os.getenv("AGENT_REASONING_EFFORT", "high")
    embed_model: str = os.getenv("AGENT_EMBED_MODEL", "text-embedding-3-large")
    # Optional OpenAI-compatible base URL. Routes every call through a gateway or
    # an OpenAI-compatible provider without code changes. Empty = OpenAI default.
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")

    # --- Reference analysis (read Korean text + describe layout) ---
    # This is a *perception* task (OCR + layout), not aesthetic taste, so an open
    # VLM is fully competitive. These default to the main vision model/endpoint
    # but can be pointed independently at Qwen3-VL (32-language OCR incl. Korean,
    # text bounding boxes) through an OpenAI-compatible provider (Together /
    # OpenRouter / DashScope) — no GPU on your side, Railway stays CPU. e.g.
    #   AGENT_ANALYZE_MODEL=Qwen/Qwen3-VL-8B-Instruct
    #   AGENT_ANALYZE_BASE_URL=https://api.together.xyz/v1  AGENT_ANALYZE_API_KEY=...
    analyze_model: str = os.getenv("AGENT_ANALYZE_MODEL", "") or os.getenv(
        "AGENT_VISION_MODEL", "gpt-5.5"
    )
    analyze_base_url: str = os.getenv("AGENT_ANALYZE_BASE_URL", "") or os.getenv(
        "OPENAI_BASE_URL", ""
    )
    analyze_api_key: str = os.getenv("AGENT_ANALYZE_API_KEY", "")

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
    # Each revision re-renders the (slow) image, so the worst case is
    # (1 + max_revisions) image generations inside one request. Default 1 to
    # keep total latency inside the route timeout; raise it with an async
    # pipeline.
    max_revisions: int = int(os.getenv("AGENT_MAX_REVISIONS", "1"))
    # Because we now BAKE the Korean copy into the image, "did the text render
    # correctly?" is its own gate. The ocr_gate node transcribes the rendered
    # card and diffs it against the intended copy; a card below this fidelity
    # threshold (0–10) loops back for a re-render even if it's visually pretty.
    # Set high — for baked text, "almost right" spelling is a publish blocker.
    text_threshold: float = float(os.getenv("AGENT_TEXT_THRESHOLD", "9.0"))

    # --- Test-Time Scaling (TTS) ---
    # These spend *inference* compute (not training / GPU) to raise quality:
    # Best-of-N self-consistency on the copy + S1-style "budget forcing" that
    # scales that compute by topic difficulty. See app/tts.py.
    tts_enabled: bool = os.getenv("AGENT_TTS_ENABLED", "true").lower() not in {
        "0",
        "false",
        "no",
    }
    # Best-of-N copy candidates. The budgeter picks the *actual* N per request
    # between min and max by difficulty (min for easy, max for hard).
    tts_max_samples: int = int(os.getenv("AGENT_TTS_MAX_SAMPLES", "4"))
    tts_min_samples: int = int(os.getenv("AGENT_TTS_MIN_SAMPLES", "1"))
    # Sampling temperature for candidate diversity (applied to non-reasoning
    # models only; reasoning models vary across calls on their own).
    tts_temperature: float = float(os.getenv("AGENT_TTS_TEMPERATURE", "0.9"))
    # Budget forcing: the revision ceiling the budgeter may scale up to for hard
    # topics. max_revisions stays the floor for easy ones.
    tts_max_revisions_ceiling: int = int(
        os.getenv("AGENT_TTS_MAX_REVISIONS_CEILING", "4")
    )

    @property
    def has_openai(self) -> bool:
        k = self.openai_api_key
        return bool(k) and k not in {"dummy_key", "your_openai_api_key_here"}

    @property
    def analyze_key(self) -> str:
        """Key for the reference-analysis endpoint, falling back to the main key
        (so pointing only AGENT_ANALYZE_MODEL at an OpenAI model just works)."""
        return self.analyze_api_key or self.openai_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
