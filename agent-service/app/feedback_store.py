"""Durable human-feedback log + aggregation.

Every human evaluation is appended as one JSON line to an append-only file
(``AGENT_FEEDBACK_LOG``). Collection is intentionally file-based so it works
offline with no DB — the same graceful-degradation principle as the RAG store.

The collected records serve three jobs:
  1. **Edit-cost metric** (paper Table 1) — feeds ``measure_control.edit_cost_summary``.
  2. **Preference learning** — per-template mean human score → a retrieval boost,
     so templates people rated highly surface more often in *future* generations.
  3. **Audit / future training** — a clean preference dataset (input → human score).

Nothing here fabricates data: aggregates are empty until real feedback arrives.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Optional

_LOCK = threading.Lock()


def _log_path() -> str:
    return os.getenv(
        "AGENT_FEEDBACK_LOG",
        os.path.join(os.path.dirname(__file__), "..", "data", "feedback.jsonl"),
    )


def log_feedback(record: dict[str, Any]) -> dict[str, Any]:
    """Append one feedback record (a timestamp is added if absent)."""
    rec = dict(record)
    rec.setdefault("ts", datetime.now(timezone.utc).isoformat())
    path = os.path.abspath(_log_path())
    with _LOCK:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


def load_records(path: Optional[str] = None) -> list[dict[str, Any]]:
    """Read all feedback records. Missing file → empty list (offline-safe)."""
    p = os.path.abspath(path or _log_path())
    if not os.path.exists(p):
        return []
    out: list[dict[str, Any]] = []
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def preference_by_template(records: Optional[list[dict]] = None) -> dict[str, float]:
    """Mean human score per template_id, normalized to 0..1 (score/10).

    A template's score is credited to every exemplar that was used to produce the
    card the human judged. Used by the retriever to up-rank well-liked designs.
    """
    recs = records if records is not None else load_records()
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for r in recs:
        score = r.get("human_score")
        if not isinstance(score, (int, float)):
            continue
        for tid in r.get("template_ids") or []:
            sums[tid] = sums.get(tid, 0.0) + float(score)
            counts[tid] = counts.get(tid, 0) + 1
    return {tid: (sums[tid] / counts[tid]) / 10.0 for tid in sums}


def edit_cost_records(records: Optional[list[dict]] = None) -> list[dict[str, Any]]:
    """Project feedback into the shape ``measure_control.edit_cost_summary`` wants."""
    recs = records if records is not None else load_records()
    out: list[dict[str, Any]] = []
    for r in recs:
        if not isinstance(r.get("seconds"), (int, float)):
            continue
        out.append(
            {
                "condition": r.get("condition", "human-critic"),
                "seconds": float(r["seconds"]),
                "regenerations": int(r.get("regenerations", 1)),
            }
        )
    return out


def _pearson(xs: list[float], ys: list[float]) -> Optional[float]:
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    denom = (sxx * syy) ** 0.5
    return (sxy / denom) if denom else None


def _rank(vals: list[float]) -> list[float]:
    """Fractional ranks with ties averaged (for Spearman)."""
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    ranks = [0.0] * len(vals)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and vals[order[j + 1]] == vals[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1  # 1-based average rank for the tie group
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def score_correlation(records: Optional[list[dict]] = None) -> dict[str, Any]:
    """Agreement between the automated Art Director score and the human score
    on the *same* card — evidence for whether the auto-judge can stand in for
    human eyes. Uses auto_score_before (the critic's score of the card the human
    then judged) vs human_score.
    """
    recs = records if records is not None else load_records()
    pairs = [
        (float(r["auto_score_before"]), float(r["human_score"]))
        for r in recs
        if isinstance(r.get("auto_score_before"), (int, float))
        and isinstance(r.get("human_score"), (int, float))
    ]
    if len(pairs) < 2:
        return {"n": len(pairs), "pearson": None, "spearman": None, "mean_abs_error": None}
    auto = [p[0] for p in pairs]
    human = [p[1] for p in pairs]
    spearman = _pearson(_rank(auto), _rank(human))
    return {
        "n": len(pairs),
        "pearson": _pearson(auto, human),
        "spearman": spearman,
        "mean_abs_error": sum(abs(a - h) for a, h in pairs) / len(pairs),
    }


def stats(records: Optional[list[dict]] = None) -> dict[str, Any]:
    """Summary for the /feedback/stats endpoint."""
    recs = records if records is not None else load_records()
    human = [float(r["human_score"]) for r in recs if isinstance(r.get("human_score"), (int, float))]
    deltas = [
        float(r["auto_score_after"]) - float(r["auto_score_before"])
        for r in recs
        if isinstance(r.get("auto_score_after"), (int, float))
        and isinstance(r.get("auto_score_before"), (int, float))
    ]
    pref = preference_by_template(recs)
    return {
        "count": len(recs),
        "mean_human_score": (sum(human) / len(human)) if human else None,
        "mean_auto_score_gain": (sum(deltas) / len(deltas)) if deltas else None,
        "templates_with_preference": len(pref),
        "top_templates": sorted(pref.items(), key=lambda kv: kv[1], reverse=True)[:5],
    }
