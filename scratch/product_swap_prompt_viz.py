"""Presentation-ready visualization of the 'Product-Swap' card-news prompt.

Renders a 16:9 infographic explaining the prompt logic:
  Image 1 (design template, locked) + Image 2 (product only) -> result.
Output: scratch/product_swap_prompt_viz.png (1920x1080).
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle, Rectangle, Wedge

# ---- fonts ----
REG = "/tmp/NanumGothic-Regular.ttf"
BLD = "/tmp/NanumGothic-Bold.ttf"
for p in (REG, BLD):
    fm.fontManager.addfont(p)
f_reg = fm.FontProperties(fname=REG)
f_bld = fm.FontProperties(fname=BLD)
plt.rcParams["axes.unicode_minus"] = False

# ---- palette ----
INK = "#1d2433"
SUB = "#5b6577"
LINE = "#d7dde8"
BG = "#f4f6fb"
CARD = "#ffffff"
ACCENT = "#3b6fe0"      # image 1 / locked
GREEN = "#1ea672"       # image 2 / product
GOLD = "#f5a623"        # result highlight
RED = "#e2553b"         # do-not
PANEL = "#eef2fb"

fig = plt.figure(figsize=(19.2, 10.8), dpi=100)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 1920)
ax.set_ylim(0, 1080)
ax.axis("off")
ax.add_patch(Rectangle((0, 0), 1920, 1080, color=BG, zorder=0))


def rbox(x, y, w, h, fc, ec="none", lw=0, rad=18, z=1, alpha=1.0):
    b = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={rad}",
                       fc=fc, ec=ec, lw=lw, zorder=z, alpha=alpha)
    ax.add_patch(b)
    return b


def txt(x, y, s, size, fp=f_reg, color=INK, ha="left", va="center", z=5, sp=None):
    t = ax.text(x, y, s, fontsize=size, fontproperties=fp, color=color,
                ha=ha, va=va, zorder=z)
    if sp is not None:
        t.set_linespacing(sp)
    return t


# ===== header =====
rbox(0, 980, 1920, 100, "#ffffff", z=1)
ax.add_patch(Rectangle((0, 978), 1920, 3, color=LINE, zorder=2))
ax.add_patch(Rectangle((80, 1006), 10, 48, color=ACCENT, zorder=3))
txt(110, 1044, "제품 교체 프롬프트  ·  Product-Swap Prompt", 30, f_bld, INK, va="center")
txt(110, 1008, "디자인은 그대로, 제품만 바꾼다 — 이미지 1의 광고 디자인을 100% 유지한 채 이미지 2의 제품만 합성",
    17, f_reg, SUB, va="center")
txt(1840, 1026, "AI CardNews · 카드뉴스 자동화", 16, f_bld, ACCENT, ha="right", va="center")

# ===== card geometry =====
cw, ch = 360, 430
cy = 470
x1 = 120          # image 1
x2 = 780          # image 2
x3 = 1440         # result
plate_cy = cy + 168


def card_shell(x, tag, tag_color, title):
    rbox(x - 14, cy - 16, cw + 28, ch + 92, "#e9edf6", z=1)   # soft frame
    rbox(x, cy, cw, ch, CARD, ec=LINE, lw=1.5, z=2)
    # tag chip
    rbox(x + 16, cy + ch - 52, 150, 36, tag_color, z=4)
    txt(x + 16 + 75, cy + ch - 34, tag, 16, f_bld, "#ffffff", ha="center")
    txt(x + cw / 2, cy + ch + 52, title, 21, f_bld, INK, ha="center")


def headline_bars(x, color):
    # mock typography placement (locked)
    ax.add_patch(Rectangle((x + 28, cy + ch - 118), 250, 22, color=color, alpha=0.9, zorder=4))
    ax.add_patch(Rectangle((x + 28, cy + ch - 152), 180, 16, color=color, alpha=0.45, zorder=4))


def badge(x, color):
    c = Circle((x + cw - 56, cy + ch - 96), 40, color=color, zorder=5)
    ax.add_patch(c)
    txt(x + cw - 56, cy + ch - 88, "50%", 17, f_bld, "#ffffff", ha="center")
    txt(x + cw - 56, cy + ch - 110, "SALE", 11, f_bld, "#ffffff", ha="center")


def burger(cx, cy0, z=5):
    # "old" product = burger (warm tones)
    ax.add_patch(Wedge((cx, cy0 - 6), 70, 0, 180, fc="#caa15a", ec="none", zorder=z))      # top bun
    ax.add_patch(Rectangle((cx - 70, cy0 - 22), 140, 16, color="#3aa05a", zorder=z))        # lettuce
    ax.add_patch(Rectangle((cx - 70, cy0 - 40), 140, 20, color="#7a4a2b", zorder=z))        # patty
    ax.add_patch(Wedge((cx, cy0 - 40), 70, 180, 360, fc="#d8b06a", ec="none", zorder=z))     # bottom bun


def bibimbap(cx, cy0, z=5, plate=True):
    # "new" product = korean rice bowl (colorful)
    if plate:
        ax.add_patch(Circle((cx, cy0 - 20), 92, color="#1b2a3a", zorder=z))                 # dark bowl
    ax.add_patch(Circle((cx, cy0 - 20), 78, color="#f2ead6", zorder=z + 1))                  # rice
    cols = ["#e2553b", "#1ea672", "#f5a623", "#7d4fc4", "#d83b6a"]
    import math
    for i, c in enumerate(cols):
        a = math.radians(90 + i * 72)
        ox, oy = 40 * math.cos(a), 40 * math.sin(a)
        ax.add_patch(Wedge((cx + ox, cy0 - 20 + oy), 26, 0, 360, fc=c, ec="none", zorder=z + 2))
    ax.add_patch(Circle((cx, cy0 - 20), 16, color="#fbe27a", zorder=z + 3))                  # egg yolk


# ---- Image 1: template (LOCKED) ----
card_shell(x1, "IMAGE 1 · 고정", ACCENT, "디자인 템플릿 (기준)")
headline_bars(x1, ACCENT)
badge(x1, GOLD)
burger(x1 + cw / 2, plate_cy)
txt(x1 + cw / 2, cy + 28, "기존 제품", 14, f_bld, SUB, ha="center")

# ---- Image 2: product source ----
card_shell(x2, "IMAGE 2 · 제품만", GREEN, "제품 소스 (음식만)")
# transparency checkerboard to signal "background removed"
import numpy as np
sq = 22
for i in range(int(cw // sq)):
    for j in range(int((ch - 60) // sq)):
        if (i + j) % 2 == 0:
            ax.add_patch(Rectangle((x2 + i * sq, cy + 60 + j * sq), sq, sq,
                                   color="#e7ecf3", zorder=3))
rbox(x2, cy, cw, 56, CARD, z=3)  # mask bottom strip to keep chip clean area
bibimbap(x2 + cw / 2, plate_cy + 10)
txt(x2 + cw / 2, cy + 30, "배경 완전 제거 → 제품/음식만 추출", 14, f_bld, GREEN, ha="center")

# ---- Result ----
card_shell(x3, "RESULT · 합성", GOLD, "교체 완료된 카드뉴스")
headline_bars(x3, ACCENT)
badge(x3, GOLD)
bibimbap(x3 + cw / 2, plate_cy)
txt(x3 + cw / 2, cy + 28, "신규 제품", 14, f_bld, SUB, ha="center")
rbox(x3 - 14, cy - 16, cw + 28, ch + 120, "none", ec=GOLD, lw=3, z=6)  # highlight

# ===== operators =====
txt((x1 + cw + x2) / 2, cy + ch / 2 + 20, "+", 70, f_bld, SUB, ha="center")
txt((x2 + cw + x3) / 2, cy + ch / 2 + 20, "=", 70, f_bld, GOLD, ha="center")

# small labels under operators
txt((x1 + cw + x2) / 2, cy + 70, "제품만\n추출", 14, f_bld, GREEN, ha="center", sp=1.3)
txt((x2 + cw + x3) / 2, cy + 70, "그대로\n끼워넣기", 14, f_bld, GOLD, ha="center", sp=1.3)

# ===== "what is locked" callout under image 1 =====
lock_items = "배경 · 레이아웃 · 타이포 위치 · 배지 위치 · 색 · 조명 · 구도 · 카메라 앵글 · 광고 스타일"
rbox(120, 250, 720, 150, PANEL, z=1)
ax.add_patch(Rectangle((120, 250), 8, 150, color=ACCENT, zorder=2))
txt(150, 372, "이미지 1이 통제하는 것 (절대 변경 금지)", 19, f_bld, ACCENT)
txt(150, 318, lock_items, 16, f_reg, INK, sp=1.5)
txt(150, 278, "→ 결과는 이미지 1과 디자인·구성이 거의 동일해야 함", 15, f_bld, SUB)

# ===== rules strip (DO NOT) =====
rbox(880, 250, 920, 150, "#fff4f1", z=1)
ax.add_patch(Rectangle((880, 250), 8, 150, color=RED, zorder=2))
txt(910, 372, "금지 (DO NOT)", 19, f_bld, RED)
chips = ["새 광고 디자인 생성", "레이아웃 재설계", "배경 새로 발명",
         "타이포 위치 변경", "배지 위치 변경", "시각적 위계 변경"]
cxp, cyp = 910, 322
for i, c in enumerate(chips):
    col = i % 3
    row = i // 3
    bx = 910 + col * 300
    by = 322 - row * 42
    rbox(bx, by - 16, 280, 34, "#ffffff", ec="#f1c4b8", lw=1.2, z=3)
    txt(bx + 14, by + 1, "X   " + c, 14.5, f_bld, RED)
txt(910, 268, "!  두 이미지가 충돌하면 → 항상 이미지 1을 따른다",
    15.5, f_bld, "#b23b22")

# ===== footer flow line =====
txt(960, 180, "최종 산출물:  원본 광고 디자인을 보존한 채 제품만 교체된, 전문가가 편집한 듯한 마케팅 카드뉴스",
    17, f_bld, INK, ha="center")
txt(960, 150, "Output: a professionally edited marketing card-news — same design, swapped product only.",
    14, f_reg, SUB, ha="center")

fig.savefig("scratch/product_swap_prompt_viz.png", dpi=100,
            facecolor=BG, bbox_inches=None, pad_inches=0)
print("saved scratch/product_swap_prompt_viz.png")
