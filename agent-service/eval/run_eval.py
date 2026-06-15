#!/usr/bin/env python3
"""Small eval harness for the Art Director critic.

Two modes:

  # 1) Logic self-test — no API key, no images. Verifies the deterministic
  #    scoring/gating math. Safe for CI.
  python eval/run_eval.py --self-test

  # 2) Image eval — runs the REAL vision critic over a set of cards and reports
  #    per-axis scores, plus accuracy vs your human labels when provided.
  python eval/run_eval.py --cases eval/cases.sample.jsonl --out eval/report.md

A "case" is one JSON object per line (JSONL):

    {"image": "samples/good_cover.png", "expected": "good", "note": "clean lower-third"}

`expected` is optional and is one of: good | ok | bad. Image paths are resolved
relative to the manifest file. With no OPENAI_API_KEY the critic can't score
images, so the harness reports them as "unscored" instead of guessing.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from typing import Any, Optional

# Make `app` importable when run as a plain script from the agent-service dir.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.nodes.art_director import (  # noqa: E402
    RUBRIC_WEIGHTS,
    TEXT_GATE_CAP,
    aggregate,
    critique_image,
)

# Score → quality band. Mirrors the product's default quality_threshold (8.0).
BANDS = [("good", 8.0), ("ok", 6.0), ("bad", 0.0)]


def score_band(score: Optional[float]) -> str:
    if score is None:
        return "unscored"
    for name, lo in BANDS:
        if score >= lo:
            return name
    return "bad"


# --------------------------------------------------------------------------- #
# Mode 1 — deterministic logic self-test (no key, no images)
# --------------------------------------------------------------------------- #
def self_test() -> bool:
    cases: list[tuple[str, float, Optional[float]]] = []

    def check(label: str, got: Optional[float], want: Optional[float]) -> None:
        ok = got == want
        cases.append((label, got if got is not None else float("nan"), want))
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}: got={got} want={want}")
        if not ok:
            self_test.failed = True  # type: ignore[attr-defined]

    self_test.failed = False  # type: ignore[attr-defined]
    full = {k: {"score": 8} for k in RUBRIC_WEIGHTS}
    perfect = {k: {"score": 10} for k in RUBRIC_WEIGHTS}

    check("all axes 8 → 8.0", aggregate(full, garbled=False), 8.0)
    check("all axes 10 → 10.0", aggregate(perfect, garbled=False), 10.0)
    check("empty axes → None", aggregate({}, garbled=False), None)
    # Weighting: only composition (w=0.25) present, score 10 → renormalised 10.0
    check("single axis renormalises", aggregate({"composition": {"score": 10}}, garbled=False), 10.0)
    # garbled-text gate caps an otherwise-perfect card
    check("garbled caps at gate", aggregate(perfect, garbled=True), TEXT_GATE_CAP)
    # bare-number axis accepted and clamped
    check("bare-number + clamp", aggregate({k: 12 for k in RUBRIC_WEIGHTS}, garbled=False), 10.0)

    assert abs(sum(RUBRIC_WEIGHTS.values()) - 1.0) < 1e-9, "weights must sum to 1.0"
    passed = not self_test.failed  # type: ignore[attr-defined]
    print(f"\nself-test: {'ALL PASS ✅' if passed else 'FAILURES ❌'} ({len(cases)} checks)")
    return passed


# --------------------------------------------------------------------------- #
# Mode 2 — image eval against the real critic
# --------------------------------------------------------------------------- #
def _load_cases(path: str) -> list[dict[str, Any]]:
    base = os.path.dirname(os.path.abspath(path))
    cases = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            obj = json.loads(line)
            obj["_path"] = os.path.join(base, obj["image"])
            cases.append(obj)
    return cases


def _b64(path: str) -> Optional[str]:
    try:
        with open(path, "rb") as fh:
            return base64.b64encode(fh.read()).decode()
    except OSError:
        return None


def evaluate(cases: list[dict[str, Any]]) -> dict[str, Any]:
    results = []
    for c in cases:
        img = _b64(c["_path"])
        if img is None:
            results.append({"image": c["image"], "error": "file not found", "band": "unscored"})
            continue
        crit = critique_image(img)
        score = crit.get("score")
        band = score_band(score)
        results.append({
            "image": c["image"],
            "score": score,
            "band": band,
            "garbled": crit.get("garbled", False),
            "axes": {k: (v.get("score") if isinstance(v, dict) else v) for k, v in (crit.get("axes") or {}).items()},
            "expected": c.get("expected"),
            "match": (c.get("expected") == band) if c.get("expected") else None,
            "fixes": crit.get("fixes", [])[:3],
        })

    labeled = [r for r in results if r.get("expected")]
    matches = [r for r in labeled if r.get("match")]
    scored = [r for r in results if isinstance(r.get("score"), (int, float))]
    summary = {
        "cases": len(results),
        "scored": len(scored),
        "labeled": len(labeled),
        "band_accuracy": (len(matches) / len(labeled)) if labeled else None,
        "mean_score": round(sum(r["score"] for r in scored) / len(scored), 2) if scored else None,
    }
    return {"summary": summary, "results": results}


def _to_markdown(report: dict[str, Any]) -> str:
    s = report["summary"]
    acc = "—" if s["band_accuracy"] is None else f"{s['band_accuracy'] * 100:.0f}%"
    lines = [
        "# Art Director critic — eval report",
        "",
        f"- cases: **{s['cases']}**  ·  scored: **{s['scored']}**  ·  labeled: **{s['labeled']}**",
        f"- band accuracy (vs human labels): **{acc}**",
        f"- mean score: **{s['mean_score']}**",
        "",
        "| image | score | band | expected | match | garbled? | top fix |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in report["results"]:
        if "error" in r:
            lines.append(f"| {r['image']} | — | unscored | — | — | — | {r['error']} |")
            continue
        match = "—" if r["match"] is None else ("✅" if r["match"] else "❌")
        fix = (r["fixes"][0] if r["fixes"] else "")[:60]
        lines.append(
            f"| {r['image']} | {r['score']} | {r['band']} | {r['expected'] or '—'} | "
            f"{match} | {'⚠️' if r['garbled'] else '·'} | {fix} |"
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Art Director critic eval harness")
    ap.add_argument("--self-test", action="store_true", help="run the deterministic scoring self-test (no key)")
    ap.add_argument("--cases", help="path to a JSONL manifest of image cases")
    ap.add_argument("--out", help="write a markdown report here (also writes <out>.json)")
    args = ap.parse_args()

    if args.self_test or not args.cases:
        ok = self_test()
        return 0 if ok else 1

    cases = _load_cases(args.cases)
    report = evaluate(cases)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(_to_markdown(report))
        with open(os.path.splitext(args.out)[0] + ".json", "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
