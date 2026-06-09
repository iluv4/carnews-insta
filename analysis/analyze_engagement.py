"""
Instagram Reference Monitoring — Engagement Time-Series Analysis
================================================================
Real data: @netflix recent posts (via Instagram Looter / RapidAPI).
Each post is one observation in an (irregular) engagement time series.

Demonstrates core time-series / EDA techniques for the class:
  1. Engagement over time (likes) with rolling mean
  2. Anomaly (viral spike) detection via robust z-score (MAD)
  3. Format effect: likes by media type
  4. Reach->engagement relationship (plays vs likes, with correlation)
  5. Posting hour-of-day vs engagement

Outputs PNGs into analysis/figures/ and prints a summary.
"""
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, "figures")
os.makedirs(FIG, exist_ok=True)

# ── Load ─────────────────────────────────────────────────────────────────────
df = pd.read_csv(os.path.join(HERE, "netflix_posts.csv"))
# taken_at is unix UTC; convert to US Eastern (Netflix US audience), EDT = UTC-4
df["dt_utc"] = pd.to_datetime(df["taken_at"], unit="s", utc=True)
# US Eastern in June = EDT = UTC-4 (fixed offset; avoids tzdata dependency)
df["dt"] = df["dt_utc"].dt.tz_localize(None) - pd.Timedelta(hours=4)
df = df.sort_values("dt").reset_index(drop=True)
df["engagement"] = df["like_count"] + df["comment_count"]

print("=" * 64)
print(f"Posts: {len(df)} | window: {df['dt'].min():%Y-%m-%d} -> {df['dt'].max():%Y-%m-%d}")
print(f"Likes  mean={df.like_count.mean():,.0f}  median={df.like_count.median():,.0f}  max={df.like_count.max():,.0f}")
print("=" * 64)

# ── 1. Engagement over time + rolling mean ───────────────────────────────────
fig, ax = plt.subplots(figsize=(11, 5))
ax.plot(df["dt"], df["like_count"], "o-", color="#E50914", lw=1.5, ms=7, label="Likes / post")
df["roll3"] = df["like_count"].rolling(3, center=True).mean()
ax.plot(df["dt"], df["roll3"], "--", color="#333", lw=1.2, label="3-post moving avg")
ax.set_title("Netflix US — Likes per Post Over Time", fontsize=14, fontweight="bold")
ax.set_ylabel("Likes"); ax.legend()
ax.yaxis.set_major_formatter(lambda x, _: f"{x/1000:.0f}K")
ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%d %Hh"))
fig.autofmt_xdate(); fig.tight_layout()
fig.savefig(os.path.join(FIG, "1_likes_over_time.png"), dpi=130); plt.close(fig)

# ── 2. Robust anomaly detection (MAD z-score) ────────────────────────────────
med = df["like_count"].median()
mad = (np.abs(df["like_count"] - med)).median() or 1
df["rz"] = 0.6745 * (df["like_count"] - med) / mad
df["is_viral"] = df["rz"] > 3.5
fig, ax = plt.subplots(figsize=(11, 5))
colors = ["#E50914" if v else "#9aa0a6" for v in df["is_viral"]]
ax.bar(range(len(df)), df["like_count"], color=colors)
ax.axhline(med, color="#333", ls="--", lw=1, label=f"median ({med/1000:.0f}K)")
for i, r in df.iterrows():
    if r["is_viral"]:
        ax.text(i, r["like_count"], "  VIRAL", va="bottom", ha="center",
                fontsize=8, fontweight="bold", color="#E50914")
ax.set_title("Viral Spike Detection (robust z-score > 3.5)", fontsize=14, fontweight="bold")
ax.set_ylabel("Likes"); ax.set_xticks(range(len(df)))
ax.set_xticklabels([c[:14] for c in df["caption"]], rotation=45, ha="right", fontsize=7)
ax.yaxis.set_major_formatter(lambda x, _: f"{x/1000:.0f}K"); ax.legend()
fig.tight_layout()
fig.savefig(os.path.join(FIG, "2_anomaly_detection.png"), dpi=130); plt.close(fig)

# ── 3. Likes by media type ───────────────────────────────────────────────────
g = df.groupby("media_type")["like_count"].agg(["mean", "count"]).sort_values("mean")
fig, ax = plt.subplots(figsize=(7, 5))
ax.bar(g.index, g["mean"], color=["#9aa0a6", "#564d4d", "#E50914"][: len(g)])
for t, r in g.iterrows():
    ax.text(t, r["mean"], f"  n={int(r['count'])}", va="bottom", ha="center", fontsize=9)
ax.set_title("Average Likes by Content Format", fontsize=14, fontweight="bold")
ax.set_ylabel("Avg likes")
ax.yaxis.set_major_formatter(lambda x, _: f"{x/1000:.0f}K")
fig.tight_layout(); fig.savefig(os.path.join(FIG, "3_by_media_type.png"), dpi=130); plt.close(fig)

# ── 4. Reach (plays) vs Likes for reels ──────────────────────────────────────
reels = df[df["play_count"] > 0].copy()
corr = reels["play_count"].corr(reels["like_count"])
fig, ax = plt.subplots(figsize=(8, 5))
ax.scatter(reels["play_count"], reels["like_count"], s=80, color="#E50914")
ax.set_xscale("log")
ax.set_title(f"Reels: Plays vs Likes  (Pearson r = {corr:.2f})", fontsize=14, fontweight="bold")
ax.set_xlabel("Plays (log)"); ax.set_ylabel("Likes")
ax.yaxis.set_major_formatter(lambda x, _: f"{x/1000:.0f}K")
fig.tight_layout(); fig.savefig(os.path.join(FIG, "4_plays_vs_likes.png"), dpi=130); plt.close(fig)

# ── 5. Hour-of-day vs engagement ─────────────────────────────────────────────
df["hour"] = df["dt"].dt.hour
fig, ax = plt.subplots(figsize=(9, 5))
ax.scatter(df["hour"], df["like_count"], s=70, color="#E50914")
ax.set_title("Posting Hour (US/Eastern) vs Likes", fontsize=14, fontweight="bold")
ax.set_xlabel("Hour of day (ET)"); ax.set_ylabel("Likes"); ax.set_xlim(0, 23)
ax.yaxis.set_major_formatter(lambda x, _: f"{x/1000:.0f}K")
fig.tight_layout(); fig.savefig(os.path.join(FIG, "5_hour_of_day.png"), dpi=130); plt.close(fig)

# ── Summary ──────────────────────────────────────────────────────────────────
top = df.loc[df["like_count"].idxmax()]
print(f"Top post: '{top['caption']}' — {top['like_count']:,} likes ({top['media_type']})")
print(f"Plays<->Likes correlation (reels): r = {corr:.2f}")
print("Avg likes by format:")
for t, r in g.iterrows():
    print(f"   {t:9s}: {r['mean']:>10,.0f}  (n={int(r['count'])})")
print(f"Viral posts (z>3.5): {df['is_viral'].sum()}")
print(f"Figures written to: {FIG}")
