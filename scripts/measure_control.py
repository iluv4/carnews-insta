"""Control-fidelity metrics for IntentCard (paper Table 1).

Measures the *control* a pipeline has over its output — not aesthetic quality.
Implemented metrics are real and runnable offline:

  * brand color   : CIEDE2000 (ΔE) between a target brand HEX and a sampled color.
  * reproducibility: pixel-level variance across N identical-spec renders.
  * editability    : edit-cost summary from a structured log (regenerations/time).

Model-dependent metrics (CLIPScore intent-alignment, font-match rate) are exposed
as clearly marked hooks that activate only when their dependencies/data are present.
Nothing here fabricates numbers: run it on real renders to populate the table.

Usage:
    python scripts/measure_control.py --demo            # synthetic sanity check
    python scripts/measure_control.py --hex '#1A237E' --image card.png --region 100 1200 900 1320
    python scripts/measure_control.py --repro a.png b.png c.png
"""
from __future__ import annotations

import argparse
import math
from typing import Optional, Sequence

try:
    import numpy as np
except ImportError:  # numpy is required for the array math
    raise SystemExit("numpy required: pip install numpy")

try:
    from PIL import Image  # optional — only needed to load real image files
    _HAVE_PIL = True
except ImportError:
    _HAVE_PIL = False


# --------------------------------------------------------------------------- #
# Color: sRGB hex -> CIE L*a*b*, then CIEDE2000 ΔE.
# --------------------------------------------------------------------------- #
def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_lab(rgb: Sequence[float]) -> tuple[float, float, float]:
    r, g, b = (_srgb_to_linear(c) for c in rgb)
    # linear sRGB -> XYZ (D65)
    x = r * 0.4124 + g * 0.3576 + b * 0.1805
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = r * 0.0193 + g * 0.1192 + b * 0.9505
    # normalize by D65 white
    xn, yn, zn = 0.95047, 1.0, 1.08883
    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t + 16 / 116)
    fx, fy, fz = f(x / xn), f(y / yn), f(z / zn)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def ciede2000(lab1: Sequence[float], lab2: Sequence[float]) -> float:
    """ΔE00 between two L*a*b* colors. 0 == identical; <2 ~ imperceptible."""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    avg_Lp = (L1 + L2) / 2
    C1 = math.hypot(a1, b1)
    C2 = math.hypot(a2, b2)
    avg_C = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(avg_C**7 / (avg_C**7 + 25**7))) if avg_C > 0 else 0
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    avg_Cp = (C1p + C2p) / 2
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    dhp = h2p - h1p
    if abs(dhp) > 180:
        dhp -= 360 * (1 if dhp > 0 else -1)
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    avg_hp = (h1p + h2p + (360 if abs(h1p - h2p) > 180 else 0)) / 2
    T = (1 - 0.17 * math.cos(math.radians(avg_hp - 30))
         + 0.24 * math.cos(math.radians(2 * avg_hp))
         + 0.32 * math.cos(math.radians(3 * avg_hp + 6))
         - 0.20 * math.cos(math.radians(4 * avg_hp - 63)))
    SL = 1 + (0.015 * (avg_Lp - 50) ** 2) / math.sqrt(20 + (avg_Lp - 50) ** 2)
    SC = 1 + 0.045 * avg_Cp
    SH = 1 + 0.015 * avg_Cp * T
    dTheta = 30 * math.exp(-(((avg_hp - 275) / 25) ** 2))
    RC = 2 * math.sqrt(avg_Cp**7 / (avg_Cp**7 + 25**7))
    RT = -RC * math.sin(math.radians(2 * dTheta))
    return math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2
                     + RT * (dCp / SC) * (dHp / SH))


def brand_color_delta_e(target_hex: str, sampled_rgb: Sequence[float]) -> float:
    """ΔE00 between the brand's target HEX and an observed (0-1) RGB sample."""
    return ciede2000(rgb_to_lab(hex_to_rgb(target_hex)), rgb_to_lab(sampled_rgb))


def dominant_text_color(arr: "np.ndarray", region: Optional[tuple[int, int, int, int]]) -> np.ndarray:
    """Median color (0-1 RGB) of the darkest 20% of pixels in a region (text ink)."""
    if region:
        x0, y0, x1, y1 = region
        arr = arr[y0:y1, x0:x1]
    flat = arr.reshape(-1, arr.shape[-1])[:, :3] / 255.0
    lum = flat @ np.array([0.2126, 0.7152, 0.0722])
    ink = flat[lum <= np.quantile(lum, 0.2)]
    return np.median(ink, axis=0)


# --------------------------------------------------------------------------- #
# Reproducibility: variance across N identical-spec renders.
# --------------------------------------------------------------------------- #
def reproducibility_variance(images: Sequence["np.ndarray"]) -> dict:
    """Mean per-pixel std across renders. 0 == perfectly reproducible."""
    if len(images) < 2:
        raise ValueError("need >= 2 renders")
    shapes = {im.shape for im in images}
    if len(shapes) != 1:
        return {"identical_shape": False, "mean_pixel_std": float("nan")}
    stack = np.stack([im.astype(np.float32) for im in images])
    std = stack.std(axis=0)
    return {
        "identical_shape": True,
        "n": len(images),
        "mean_pixel_std": float(std.mean()),         # 0..255 scale
        "max_pixel_std": float(std.max()),
        "frac_pixels_changed": float((std.mean(axis=-1) > 1.0).mean()),
    }


# --------------------------------------------------------------------------- #
# Editability: summarize an edit-cost log (collected from the UI/harness).
# --------------------------------------------------------------------------- #
def edit_cost_summary(records: Sequence[dict]) -> dict:
    """records: [{'condition': 'overlay'|'baked', 'seconds': float, 'regenerations': int}]"""
    out: dict = {}
    for cond in {r["condition"] for r in records}:
        rs = [r for r in records if r["condition"] == cond]
        out[cond] = {
            "n": len(rs),
            "mean_seconds": sum(r["seconds"] for r in rs) / len(rs),
            "mean_regenerations": sum(r["regenerations"] for r in rs) / len(rs),
        }
    return out


# --------------------------------------------------------------------------- #
# Model-dependent hooks (activate only when deps/data exist — no fabrication).
# --------------------------------------------------------------------------- #
def clipscore(intent_text: str, image_path: str) -> Optional[float]:
    """Intent↔image alignment via CLIP. Returns None if CLIP isn't installed."""
    try:
        import open_clip  # type: ignore  # noqa: F401
    except ImportError:
        print("  [clipscore] open_clip not installed — skipping (pip install open_clip_torch)")
        return None
    raise NotImplementedError(
        "Wire up open_clip: encode intent_text & image, return cosine*2.5 (CLIPScore).")


def font_match_rate(spec_font: str, rendered_meta: Optional[dict]) -> Optional[bool]:
    """For the overlay layer this is exact-by-construction (renderer enforces font)."""
    if rendered_meta is None:
        return None
    return rendered_meta.get("font") == spec_font


# --------------------------------------------------------------------------- #
def _load(path: str) -> "np.ndarray":
    if not _HAVE_PIL:
        raise SystemExit("Pillow required to load images: pip install pillow")
    return np.asarray(Image.open(path).convert("RGB"))


def _load_feedback_edit_records(path: Optional[str]) -> list[dict]:
    """Read the agent-service human-feedback JSONL and project to edit-cost rows.

    Mirrors agent-service/app/feedback_store.py without importing it (this script
    runs standalone). Default path matches the service's AGENT_FEEDBACK_LOG.
    """
    import json
    import os

    p = path or os.getenv(
        "AGENT_FEEDBACK_LOG",
        os.path.join(os.path.dirname(__file__), "..", "agent-service", "data", "feedback.jsonl"),
    )
    p = os.path.abspath(p)
    if not os.path.exists(p):
        return []
    rows: list[dict] = []
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(r.get("seconds"), (int, float)):
                rows.append(
                    {
                        "condition": r.get("condition", "human-critic"),
                        "seconds": float(r["seconds"]),
                        "regenerations": int(r.get("regenerations", 1)),
                    }
                )
    return rows


def _auto_vs_human_correlation(path: Optional[str]) -> dict:
    """Pearson/Spearman between the Art Director's score and the human's score on
    the same card — quantifies whether the auto-judge can stand in for human eyes.
    """
    import json
    import os

    p = path or os.getenv(
        "AGENT_FEEDBACK_LOG",
        os.path.join(os.path.dirname(__file__), "..", "agent-service", "data", "feedback.jsonl"),
    )
    p = os.path.abspath(p)
    auto: list[float] = []
    human: list[float] = []
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue
                a, h = r.get("auto_score_before"), r.get("human_score")
                if isinstance(a, (int, float)) and isinstance(h, (int, float)):
                    auto.append(float(a))
                    human.append(float(h))
    n = len(auto)
    if n < 2:
        return {"n": n, "pearson": None, "spearman": None, "mean_abs_error": None}
    a = np.array(auto)
    h = np.array(human)
    pearson = float(np.corrcoef(a, h)[0, 1]) if a.std() and h.std() else None
    # Spearman = Pearson on ranks (ties averaged via argsort-of-argsort + tie fix).
    ra = _avg_rank(a)
    rh = _avg_rank(h)
    spearman = float(np.corrcoef(ra, rh)[0, 1]) if ra.std() and rh.std() else None
    return {
        "n": n,
        "pearson": pearson,
        "spearman": spearman,
        "mean_abs_error": float(np.abs(a - h).mean()),
    }


def _avg_rank(arr: "np.ndarray") -> "np.ndarray":
    """Ranks with ties averaged."""
    order = np.argsort(arr, kind="mergesort")
    ranks = np.empty(len(arr), dtype=float)
    ranks[order] = np.arange(1, len(arr) + 1, dtype=float)
    # average tied groups
    for val in np.unique(arr):
        mask = arr == val
        if mask.sum() > 1:
            ranks[mask] = ranks[mask].mean()
    return ranks


def _demo() -> None:
    print("== DEMO (synthetic sanity check) ==")
    # brand color: target navy vs a slightly-off render
    target = "#1A237E"
    off = [r * 1.06 for r in hex_to_rgb("#1A237E")]
    print(f"brand ΔE00 (exact overlay) : {brand_color_delta_e(target, hex_to_rgb(target)):.3f}  (expect 0)")
    print(f"brand ΔE00 (6% off, baked) : {brand_color_delta_e(target, off):.3f}  (visible if >2)")

    # reproducibility: identical overlay (std 0) vs noisy baked-in (std > 0)
    base = (np.random.rand(64, 64, 3) * 255).astype(np.uint8)
    overlay = [base.copy() for _ in range(3)]                     # deterministic
    baked = [np.clip(base + np.random.randint(-15, 15, base.shape), 0, 255).astype(np.uint8)
             for _ in range(3)]                                   # non-deterministic
    print("repro (overlay)            :", reproducibility_variance(overlay))
    print("repro (baked-in)           :", reproducibility_variance(baked))

    print("edit cost                  :", edit_cost_summary([
        {"condition": "overlay", "seconds": 4.0, "regenerations": 0},
        {"condition": "overlay", "seconds": 5.0, "regenerations": 0},
        {"condition": "baked", "seconds": 35.0, "regenerations": 1},
        {"condition": "baked", "seconds": 40.0, "regenerations": 2},
    ]))
    print("\nReal numbers come from running this on actual renders. [DATA TBD]")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--hex", help="target brand HEX, e.g. '#1A237E'")
    ap.add_argument("--image", help="rendered card image to sample text color from")
    ap.add_argument("--region", nargs=4, type=int, metavar=("X0", "Y0", "X1", "Y1"))
    ap.add_argument("--repro", nargs="+", help="2+ identical-spec renders to compare")
    ap.add_argument("--feedback-log", nargs="?", const="", help="summarize edit cost from the agent-service human-feedback JSONL")
    ap.add_argument("--correlation", nargs="?", const="", help="auto (Art Director) vs human score correlation from the feedback JSONL")
    args = ap.parse_args()

    if args.feedback_log is not None:
        records = _load_feedback_edit_records(args.feedback_log or None)
        if not records:
            print("no human-feedback edit records found [DATA TBD]")
        else:
            print("edit cost (from human feedback):", edit_cost_summary(records))
        return 0

    if args.correlation is not None:
        corr = _auto_vs_human_correlation(args.correlation or None)
        if corr["n"] < 2:
            print(f"need >= 2 records with both scores (have {corr['n']}) [DATA TBD]")
        else:
            print("auto (Art Director) vs human:")
            print(f"  n              = {corr['n']}")
            print(f"  Pearson  r     = {corr['pearson']:.3f}" if corr["pearson"] is not None else "  Pearson  r     = n/a")
            print(f"  Spearman rho   = {corr['spearman']:.3f}" if corr["spearman"] is not None else "  Spearman rho   = n/a")
            print(f"  mean |Δ| (0-10)= {corr['mean_abs_error']:.3f}")
        return 0

    if args.demo or not any([args.hex, args.repro]):
        _demo()
        return 0
    if args.hex and args.image:
        arr = _load(args.image)
        sampled = dominant_text_color(arr, tuple(args.region) if args.region else None)
        de = brand_color_delta_e(args.hex, sampled)
        print(f"brand color ΔE00 = {de:.3f}  (target {args.hex}, sampled rgb={sampled.round(3).tolist()})")
    if args.repro:
        imgs = [_load(p) for p in args.repro]
        print("reproducibility:", reproducibility_variance(imgs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
