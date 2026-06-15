"""Test-Time Scaling (TTS) toolkit — raise output quality with *inference*
compute only. No GPU, no fine-tuning, no extra training data.

Two techniques from the test-time-scaling literature, applied to the card-news
pipeline:

* **Best-of-N self-consistency** (`self_consistency`): sample several
  independent candidates and keep the one a reward function scores highest.
  Averaging out the variance of a single greedy decode is the cheapest reliable
  quality win — exactly the "CoT boosting beats a single inference" idea.
* **Budget forcing à la S1** (`estimate_difficulty` + `budget_for`): spend more
  of that inference compute on hard requests and less on easy ones, instead of a
  flat cost for everything ("동적으로 리소스를 할당").

Everything degrades to a deterministic heuristic when no API key is set, so the
graph still runs offline / in CI without spending a token.
"""
from __future__ import annotations

from typing import Any, Callable

from .config import get_settings
from .models import chat_json

_JUDGE_SYS = (
    "You are a ruthless Korean Instagram editor scoring card-news copy. "
    "Output ONLY JSON."
)


# --- Best-of-N self-consistency -------------------------------------------
def self_consistency(
    generate: Callable[[int], Any],
    reward: Callable[[Any], float],
    n: int,
) -> tuple[Any, float, list[float]]:
    """Sample ``n`` candidates and return ``(best, best_reward, all_rewards)``.

    ``generate(i)`` produces candidate ``i`` (the index lets the caller make the
    first draft greedy and the rest higher-temperature); ``reward(cand)`` scores
    it. The highest reward wins; ties keep the earliest (most stable) candidate.
    """
    n = max(1, int(n))
    best: Any = None
    best_r = float("-inf")
    scores: list[float] = []
    for i in range(n):
        cand = generate(i)
        r = float(reward(cand))
        scores.append(r)
        if r > best_r:
            best, best_r = cand, r
    return best, best_r, scores


# --- Reward model for copy candidates -------------------------------------
def score_copy(
    topic: str, slides: list[dict], examples: list[dict] | None = None
) -> float:
    """Reward (0..10) for one copy candidate.

    Uses an LLM judge when a key is configured, otherwise a deterministic
    heuristic proxy so the selector is always callable (and reproducible in CI).
    """
    if not slides:
        return 0.0
    s = get_settings()
    if s.has_openai:
        ex = "\n".join(f"- {e.get('summary', '')}" for e in (examples or [])[:3]) or "(없음)"
        prompt = (
            f'주제: "{topic}"\n참고 인기 카피 톤:\n{ex}\n\n'
            f"평가할 카피(JSON):\n{slides}\n\n"
            "후크 강도, 한국어 자연스러움, 톤 일치, 정보 명확성, CTA 매력을 종합해 "
            '0~10점으로 평가하라. 반드시 이 JSON: {"score":0-10,"reason":"..."}'
        )
        data = chat_json(_JUDGE_SYS, prompt, max_tokens=300)
        if isinstance(data, dict) and "score" in data:
            try:
                return max(0.0, min(10.0, float(data["score"])))
            except (TypeError, ValueError):
                pass
    return _heuristic_copy_score(slides)


def _has_emoji(text: str) -> bool:
    # Cheap proxy: most emoji live well above the BMP symbol block.
    return any(ord(ch) > 0x2600 for ch in text)


def _heuristic_copy_score(slides: list[dict]) -> float:
    """Key-free proxy reward: rewards complete, punchy, emoji-rich Korean copy
    with sane field lengths. Deterministic — same input, same score."""
    total = 0.0
    for sl in slides:
        s = 0.0
        title = (sl.get("title") or "").strip()
        bullets = sl.get("bullets") or []
        if title:
            s += 3.0
            if 4 <= len(title) <= 28:  # punchy headline, not a paragraph
                s += 1.0
        if isinstance(bullets, list) and 2 <= len(bullets) <= 3:
            s += 3.0
        if isinstance(bullets, list) and any(_has_emoji(str(b)) for b in bullets):
            s += 1.5
        if (sl.get("footer") or "").strip():
            s += 1.5
        total += min(10.0, s)
    return total / max(1, len(slides))


# --- Budget forcing (S1) --------------------------------------------------
def estimate_difficulty(topic: str, plan: list[dict] | None = None) -> float:
    """Estimate how hard this card-news is to write well: 0.0 (easy)..1.0 (hard).

    LLM estimate when a key is configured, deterministic heuristic otherwise.
    """
    plan = plan or []
    s = get_settings()
    if s.has_openai:
        prompt = (
            f'주제: "{topic}"\n슬라이드 수: {len(plan)}\n\n'
            "이 카드뉴스를 매력적이고 정확하게 작성하는 난이도를 평가하라. "
            "전문성·모호성·분량·사실 정확성 요구가 높을수록 높다. "
            '반드시 이 JSON: {"difficulty":0.0-1.0}'
        )
        data = chat_json(_JUDGE_SYS, prompt, max_tokens=120)
        if isinstance(data, dict) and "difficulty" in data:
            try:
                return max(0.0, min(1.0, float(data["difficulty"])))
            except (TypeError, ValueError):
                pass
    return _heuristic_difficulty(topic, plan)


def _heuristic_difficulty(topic: str, plan: list[dict]) -> float:
    length_d = min(1.0, len(topic.split()) / 12.0)
    slide_d = min(1.0, len(plan) / 8.0)
    # Topics mixing latin terms + digits (models, specs, years) lean harder.
    techy = any(c.isdigit() for c in topic) and any(c.isascii() and c.isalpha() for c in topic)
    return min(1.0, 0.5 * length_d + 0.3 * slide_d + (0.2 if techy else 0.0))


def budget_for(difficulty: float) -> dict[str, Any]:
    """Budget forcing: map difficulty → per-request inference budget.

    Easy topics get a single greedy decode and the default revision cap; hard
    topics get more Best-of-N samples and a higher revision ceiling — compute
    spent where it actually moves quality.
    """
    s = get_settings()
    d = max(0.0, min(1.0, float(difficulty)))
    if not s.tts_enabled:
        return {
            "n_samples": 1,
            "max_revisions": s.max_revisions,
            "threshold": s.quality_threshold,
            "difficulty": d,
        }
    lo, hi = s.tts_min_samples, s.tts_max_samples
    n_samples = lo + round(d * (hi - lo))
    rev = s.max_revisions + round(d * (s.tts_max_revisions_ceiling - s.max_revisions))
    return {
        "n_samples": int(max(lo, min(hi, n_samples))),
        "max_revisions": int(max(s.max_revisions, rev)),
        "threshold": s.quality_threshold,
        "difficulty": d,
    }
