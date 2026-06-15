"""Offline evaluation: does the Art Director critic agree with humans?

The agent loop trusts the vision critic's score as its quality gate. This
harness measures whether that score actually tracks human judgement, so the gate
is *validated*, not assumed. It's the missing piece called out in
`docs/PROFESSOR_SHOWCASE.md` §8 (Q5) and `AI_ENGINEER_GAP_ROADMAP.md`.

What it does
------------
For each item in a golden set (a rendered card + a human 0~10 score):
  1. run the real `art_director` critic on the card image,
  2. collect (human_score, critic_score) pairs,
  3. report agreement metrics — Pearson r, Spearman ρ, MAE, RMSE, and a
     pass/fail confusion at the production threshold.

Golden set format (JSONL, one object per line)
----------------------------------------------
    {"id": "card_001", "image_path": "cards/card_001.png", "human_score": 8.0,
     "note": "clean hierarchy, good overlay space"}
  - `image_path` (relative to the JSONL file) OR `image_b64` (raw/data-URL).
  - `human_score` in [0, 10].
See `golden_set.example.jsonl` for a template.

Usage
-----
    # real run (needs OPENAI_API_KEY + a filled golden set)
    python -m eval.critic_eval --golden eval/golden_set.jsonl

    # plumbing check with no key / no images: the critic passes items through at
    # the threshold, so this exercises the harness end-to-end offline.
    python -m eval.critic_eval --golden eval/golden_set.example.jsonl

    # write a machine-readable report
    python -m eval.critic_eval --golden eval/golden_set.jsonl --json out/report.json

Pearson/Spearman are computed in pure Python so the eval has no scipy/numpy
dependency and runs anywhere the service does.
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import os
import sys
from typing import Any, Optional

# Allow `python eval/critic_eval.py` as well as `-m eval.critic_eval`.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import get_settings  # noqa: E402
from app.nodes.art_director import art_director  # noqa: E402


# --------------------------------------------------------------------------- #
# stats (pure python — no numpy/scipy)
# --------------------------------------------------------------------------- #
def _pearson(xs: list[float], ys: list[float]) -> Optional[float]:
    n = len(xs)
    if n < 2:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0 or dy == 0:
        return None  # no variance → correlation undefined
    return num / (dx * dy)


def _rank(values: list[float]) -> list[float]:
    """Average-rank (ties share the mean of their positions)."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0  # 1-based average rank
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def _spearman(xs: list[float], ys: list[float]) -> Optional[float]:
    if len(xs) < 2:
        return None
    return _pearson(_rank(xs), _rank(ys))


def _mae(xs: list[float], ys: list[float]) -> float:
    return sum(abs(x - y) for x, y in zip(xs, ys)) / len(xs)


def _rmse(xs: list[float], ys: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(xs, ys)) / len(xs))


# --------------------------------------------------------------------------- #
# golden set loading
# --------------------------------------------------------------------------- #
def _load_image_b64(item: dict[str, Any], base_dir: str) -> Optional[str]:
    if item.get("image_b64"):
        return str(item["image_b64"])
    rel = item.get("image_path")
    if not rel:
        return None
    path = rel if os.path.isabs(rel) else os.path.join(base_dir, rel)
    if not os.path.exists(path):
        print(f"  ⚠️  image not found: {path}", file=sys.stderr)
        return None
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def load_golden(path: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"  ⚠️  skip line {ln}: {e}", file=sys.stderr)
                continue
            if "human_score" not in obj:
                print(f"  ⚠️  skip line {ln}: no human_score", file=sys.stderr)
                continue
            items.append(obj)
    return items


# --------------------------------------------------------------------------- #
# run
# --------------------------------------------------------------------------- #
def evaluate(golden_path: str) -> dict[str, Any]:
    s = get_settings()
    base_dir = os.path.dirname(os.path.abspath(golden_path))
    items = load_golden(golden_path)
    if not items:
        raise SystemExit(f"no usable items in {golden_path}")

    rows: list[dict[str, Any]] = []
    for it in items:
        img = _load_image_b64(it, base_dir)
        # art_director reads card_image_b64 off the state and returns {score, ...}
        out = art_director({"card_image_b64": img})
        critic = float(out.get("score", 0.0))
        human = float(it["human_score"])
        rows.append(
            {
                "id": it.get("id", f"item_{len(rows)}"),
                "human": human,
                "critic": critic,
                "has_image": img is not None,
                "note": it.get("note", ""),
            }
        )

    humans = [r["human"] for r in rows]
    critics = [r["critic"] for r in rows]
    thr = s.quality_threshold

    # pass/fail confusion at the production threshold (human is ground truth)
    tp = sum(1 for r in rows if r["human"] >= thr and r["critic"] >= thr)
    tn = sum(1 for r in rows if r["human"] < thr and r["critic"] < thr)
    fp = sum(1 for r in rows if r["human"] < thr and r["critic"] >= thr)
    fn = sum(1 for r in rows if r["human"] >= thr and r["critic"] < thr)
    agreement = (tp + tn) / len(rows) if rows else 0.0

    graded = sum(1 for r in rows if r["has_image"])
    report = {
        "golden_set": os.path.relpath(golden_path),
        "n": len(rows),
        "graded_with_image": graded,
        "vision_model": s.vision_model,
        "has_openai_key": s.has_openai,
        "threshold": thr,
        "pearson_r": _pearson(humans, critics),
        "spearman_rho": _spearman(humans, critics),
        "mae": _mae(humans, critics),
        "rmse": _rmse(humans, critics),
        "threshold_agreement": agreement,
        "confusion": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "rows": rows,
    }
    return report


def _fmt(x: Optional[float]) -> str:
    return "n/a" if x is None else f"{x:+.3f}" if abs(x) < 10 else f"{x:.3f}"


def print_report(rep: dict[str, Any]) -> None:
    print("\n" + "=" * 64)
    print("  ART DIRECTOR CRITIC — agreement with human scores")
    print("=" * 64)
    print(f"  golden set     : {rep['golden_set']}  (n={rep['n']})")
    print(f"  vision model   : {rep['vision_model']}   key={'yes' if rep['has_openai_key'] else 'NO (passthrough)'}")
    print(f"  graded w/ image: {rep['graded_with_image']}/{rep['n']}")
    print("-" * 64)
    print(f"  {'id':<16}{'human':>8}{'critic':>8}{'|err|':>8}   note")
    for r in rep["rows"]:
        err = abs(r["human"] - r["critic"])
        flag = "" if r["has_image"] else "  (no img)"
        print(f"  {r['id'][:16]:<16}{r['human']:>8.1f}{r['critic']:>8.1f}{err:>8.2f}   {r['note'][:24]}{flag}")
    print("-" * 64)
    print(f"  Pearson r      : {_fmt(rep['pearson_r'])}     (linear agreement)")
    print(f"  Spearman ρ     : {_fmt(rep['spearman_rho'])}     (rank agreement)")
    print(f"  MAE            : {rep['mae']:.3f}      RMSE: {rep['rmse']:.3f}")
    c = rep["confusion"]
    print(f"  pass/fail @ {rep['threshold']:<4}: agreement {rep['threshold_agreement']*100:.0f}%  "
          f"(tp={c['tp']} tn={c['tn']} fp={c['fp']} fn={c['fn']})")
    print("=" * 64)
    if not rep["has_openai_key"]:
        print("  ⚠️  No OPENAI_API_KEY: critic passed every item through at the")
        print("     threshold, so correlations are degenerate. This run only")
        print("     verifies the harness. Fill a real golden set + set the key.")
    elif rep["n"] < 8:
        print("  ℹ️  Small n — treat correlations as directional, not significant.")
    print()


def main() -> None:
    ap = argparse.ArgumentParser(description="Evaluate the Art Director critic vs human scores.")
    ap.add_argument("--golden", default=os.path.join(os.path.dirname(__file__), "golden_set.example.jsonl"),
                    help="path to the golden-set JSONL")
    ap.add_argument("--json", dest="json_out", default=None, help="optional path to write the JSON report")
    args = ap.parse_args()

    rep = evaluate(args.golden)
    print_report(rep)
    if args.json_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.json_out)), exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(rep, f, ensure_ascii=False, indent=2)
        print(f"  → wrote {args.json_out}\n")


if __name__ == "__main__":
    main()
