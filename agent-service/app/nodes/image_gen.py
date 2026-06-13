"""Image generation node — full-card render via gpt-image-2."""
from __future__ import annotations

from ..models import generate_card_image
from ..schemas import AgentState


def image_gen(state: AgentState) -> AgentState:
    if not state.get("render_image", True):
        return {"card_image_b64": None, "provider": "skipped"}
    prompt = state.get("image_prompt", "")
    b64 = generate_card_image(prompt)
    return {
        "card_image_b64": b64,
        "provider": "gpt-image-2" if b64 else "fallback-none",
    }
