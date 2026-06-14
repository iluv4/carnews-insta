"""Educational visualization of diffusion concepts for the card-news project."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

rng = np.random.default_rng(7)

# ---- build a simple synthetic "card" image (no real glyphs, just shapes) ----
H = W = 96
img = np.zeros((H, W, 3))
yy, xx = np.mgrid[0:H, 0:W]
# sky-ish vertical gradient background
img[..., 0] = 0.25 + 0.5 * (yy / H)
img[..., 1] = 0.45 + 0.4 * (yy / H)
img[..., 2] = 0.75 - 0.2 * (yy / H)
# a "car" (rounded rectangle) in lower middle
car = (np.abs(xx - 48) < 28) & (np.abs(yy - 62) < 12)
img[car] = [0.85, 0.2, 0.2]
wheels = ((xx - 33) ** 2 + (yy - 74) ** 2 < 25) | ((xx - 63) ** 2 + (yy - 74) ** 2 < 25)
img[wheels] = [0.1, 0.1, 0.1]
# a "sun"
sun = (xx - 75) ** 2 + (yy - 20) ** 2 < 60
img[sun] = [1.0, 0.9, 0.3]
img = np.clip(img, 0, 1)


def noisy(x0, frac):
    """Forward diffusion: blend signal with gaussian noise. frac in [0,1]."""
    a = np.sqrt(1 - frac)
    n = rng.standard_normal(x0.shape)
    return np.clip(a * x0 + np.sqrt(frac) * (0.5 + 0.5 * n), 0, 1)


fig = plt.figure(figsize=(15, 11))
fig.suptitle("Diffusion for Card-News Background Generation", fontsize=19, fontweight="bold")

steps = [0.0, 0.15, 0.4, 0.7, 0.92, 1.0]
labels_fwd = ["t=0\n(clean)", "t=200", "t=500", "t=800", "t=950", "t=1000\n(pure noise)"]

# Row 1: forward (adding noise)
for i, (f, lb) in enumerate(zip(steps, labels_fwd)):
    ax = plt.subplot2grid((4, 6), (0, i))
    ax.imshow(noisy(img, f))
    ax.set_title(lb, fontsize=9)
    ax.axis("off")
plt.subplot2grid((4, 6), (0, 0)).set_ylabel("")
fig.text(0.5, 0.755, "FORWARD  ──  add noise step by step  ──►",
         ha="center", fontsize=12, color="#b00", fontweight="bold")

# Row 2: reverse (denoising / generation)
for i, (f, lb) in enumerate(zip(reversed(steps),
                                ["start:\npure noise", "step 5", "step 15", "step 30", "step 45", "DONE\n(clean bg)"])):
    ax = plt.subplot2grid((4, 6), (1, i))
    ax.imshow(noisy(img, f))
    ax.set_title(lb, fontsize=9)
    ax.axis("off")
fig.text(0.5, 0.515, "REVERSE  ──  model predicts & removes noise (this IS generation)  ──►",
         ha="center", fontsize=12, color="#06c", fontweight="bold")

# Row 3 left: DDPM vs DDIM staircase
ax = plt.subplot2grid((4, 6), (2, 0), colspan=3, rowspan=2)
ax.set_title("DDPM vs DDIM : how many steps to denoise", fontsize=12, fontweight="bold")
x = np.linspace(0, 10, 100)
ax.plot(x, 10 - x, color="0.8", lw=1)
# DDPM many small steps
dd = np.arange(0, 11, 0.5)
ax.step(dd, 10 - dd, where="post", color="#b00", lw=1.5, label="DDPM ~1000 tiny steps (slow)")
# DDIM few big steps
di = np.arange(0, 11, 2.5)
ax.step(di, 10 - di, where="post", color="#06c", lw=2.5, label="DDIM ~20-50 big steps (fast, deterministic)")
ax.scatter(di, 10 - di, color="#06c", zorder=5, s=40)
ax.set_xlabel("denoising progress  ──►")
ax.set_ylabel("remaining noise")
ax.legend(fontsize=9, loc="upper right")
ax.set_xticks([]); ax.set_yticks([])

# Row 3 right: pipeline flow
ax = plt.subplot2grid((4, 6), (2, 3), colspan=3, rowspan=2)
ax.set_title("CardGAN pipeline (where each piece fits)", fontsize=12, fontweight="bold")
ax.axis("off")
ax.set_xlim(0, 10); ax.set_ylim(0, 10)

boxes = [
    (5, 9.0, "ControlNet\n(force composition:\nkeep top empty)", "#e8f0ff"),
    (5, 7.0, "Diffusion + DDIM\n(generate TEXT-FREE background)", "#fff0e8"),
    (5, 5.0, "Inpainting + SAM\n(erase leftover objects/text)", "#fff0e8"),
    (5, 3.0, "GAN layout\n(place Korean caption box,\navoid salient object)", "#e8ffe8"),
    (5, 1.0, "CSS typography overlay\n(crisp Hangul - no garbling)", "#f3e8ff"),
]
for (cx, cy, txt, col) in boxes:
    b = FancyBboxPatch((cx - 3.2, cy - 0.65), 6.4, 1.3,
                       boxstyle="round,pad=0.1", fc=col, ec="0.4", lw=1.2)
    ax.add_patch(b)
    ax.text(cx, cy, txt, ha="center", va="center", fontsize=8.5)
for cy in [9.0, 7.0, 5.0, 3.0]:
    ax.add_patch(FancyArrowPatch((5, cy - 0.7), (5, cy - 1.3),
                 arrowstyle="-|>", mutation_scale=14, color="0.3"))

plt.tight_layout(rect=[0, 0, 1, 0.96])
out = "/home/user/carnews-insta/scratch/diffusion_explained.png"
plt.savefig(out, dpi=120, bbox_inches="tight")
print("saved", out)
