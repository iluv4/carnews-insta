/**
 * IntentCard — 컴퓨터 비전 발표자료 생성 스크립트
 *
 * 실행: node scripts/generate-cv-presentation-pptx.js
 * 출력: scratch/intentcard-cv-presentation.pptx
 *
 * Notion "카드뉴스 에이전트 발표자료" + 실제 개발한 시스템(IntentCard)을
 * "컴퓨터 비전" 관점으로 재구성한 발표 덱.
 *   - CV 선행연구(레이아웃 생성 · 이미지 내 텍스트 렌더 · 검색기반 생성)
 *   - 우리가 만든 것(2-서비스, RAG + LangGraph 멀티에이전트 self-correction)
 *   - 평가 자동화(눈으로 보던 품질을 정량 지표로) ⭐ 질문 반영
 *   - 향후 연구: A2A / MCP ⭐ 질문 반영
 */

const path = require("path");
const fs = require("fs");
const PptxGenJS = require("pptxgenjs");

const ROOT = path.join(__dirname, "..");
const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Hyunmin Han";
pptx.company = "carnews-insta";
pptx.subject = "IntentCard — 컴퓨터 비전 발표";
pptx.title = "IntentCard: 비전공자의 디자인 의도를 통제 가능하게 만드는 카드뉴스 생성";

const W = 13.333;
const H = 7.5;

// ---- Design tokens ---------------------------------------------------------
const C = {
  bg: "0E0E14",
  bg2: "181822",
  panel: "1C1C28",
  line: "2C2C3C",
  fg: "F5F5F7",
  muted: "9A9AA8",
  dim: "6E6E80",
  accent: "FF7A45", // orange
  accent2: "FFB088", // light orange
  purple: "A855F7",
  good: "5AD19A",
  bad: "FF6B6B",
  white: "FFFFFF",
};
const FONT = "Pretendard"; // 미설치 시 뷰어가 기본 한글 폰트로 대체 렌더
const FONT_MONO = "Consolas";

const img = (p) => path.join(ROOT, p);
const has = (p) => fs.existsSync(img(p));

// ---- Helpers ---------------------------------------------------------------
function base(slide) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W * 0.55, h: 0.09, fill: { color: C.accent }, line: { type: "none" },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: W * 0.55, y: 0, w: W * 0.45, h: 0.09, fill: { color: C.purple }, line: { type: "none" },
  });
}

function kicker(slide, text) {
  slide.addText(text.toUpperCase(), {
    x: 0.9, y: 0.62, w: 11.5, h: 0.4,
    fontFace: FONT, fontSize: 13, bold: true, color: C.accent, charSpacing: 2,
  });
}

function title(slide, runs, opts = {}) {
  slide.addText(runs, {
    x: 0.9, y: 1.02, w: 11.5, h: 1.3,
    fontFace: FONT, fontSize: opts.fontSize || 30, bold: true,
    color: C.fg, lineSpacing: opts.lineSpacing || 36, align: "left",
  });
}

let _page = 1;
function footer(slide) {
  _page += 1;
  const page = String(_page).padStart(2, "0");
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.9, y: 6.92, w: 0.35, h: 0.05, fill: { color: C.accent }, line: { type: "none" },
  });
  slide.addText("IntentCard · Computer Vision Seminar", {
    x: 0.9, y: 7.0, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, align: "left",
  });
  slide.addText(page, {
    x: 10.4, y: 7.0, w: 2.0, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, align: "right",
  });
}

function card(slide, x, y, w, h, fill = C.bg2, lineColor = C.line) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: lineColor, width: 1 },
  });
}

function chips(slide, items, x, y, w, color = C.accent2) {
  let cx = x, cy = y;
  const chipH = 0.46, pad = 0.22, gap = 0.18;
  items.forEach((it) => {
    const cw = Math.min(0.16 * it.length + pad * 2, w);
    if (cx + cw > x + w) { cx = x; cy += chipH + gap; }
    slide.addShape(pptx.ShapeType.roundRect, {
      x: cx, y: cy, w: cw, h: chipH, rectRadius: 0.23,
      fill: { color: C.bg2 }, line: { color: C.line, width: 1 },
    });
    slide.addText(it, {
      x: cx, y: cy, w: cw, h: chipH,
      fontFace: FONT, fontSize: 12, color, align: "center", valign: "middle",
    });
    cx += cw + gap;
  });
}

// 화살표로 잇는 가로 파이프라인
function pipeline(slide, stages, y, h, boxW, gap) {
  const n = stages.length;
  const totalW = n * boxW + (n - 1) * gap;
  let x = (W - totalW) / 2;
  stages.forEach((st, i) => {
    const hot = !!st.hot;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: boxW, h, rectRadius: 0.12,
      fill: { color: hot ? C.panel : C.bg2 },
      line: { color: hot ? C.accent : C.line, width: hot ? 1.5 : 1 },
    });
    slide.addText(st.sub.toUpperCase(), {
      x, y: y + 0.16, w: boxW, h: 0.3, fontFace: FONT_MONO, fontSize: 9, bold: true,
      color: hot ? C.accent : C.dim, align: "center", charSpacing: 1,
    });
    slide.addText(st.t, {
      x: x + 0.08, y: y + 0.5, w: boxW - 0.16, h: h - 0.6, fontFace: FONT, fontSize: 12.5, bold: true,
      color: C.fg, align: "center", valign: "middle", lineSpacing: 16,
    });
    if (i < n - 1) {
      slide.addText("→", {
        x: x + boxW - 0.04, y, w: gap + 0.08, h,
        fontFace: FONT, fontSize: 17, color: C.accent, align: "center", valign: "middle",
      });
    }
    x += boxW + gap;
  });
}

// ===========================================================================
// SLIDE 1 — Cover
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 8.6, y: 0, w: W - 8.6, h: H, fill: { color: "7C3AED" }, line: { type: "none" } });
  s.addShape(pptx.ShapeType.rect, { x: 8.6, y: 0, w: W - 8.6, h: H * 0.42, fill: { color: C.accent }, line: { type: "none" } });
  if (has("public/logo.png")) {
    s.addImage({ path: img("public/logo.png"), x: 9.55, y: 2.3, w: 2.85, h: 2.85, rounding: true });
  } else {
    for (let i = 0; i < 4; i++) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 9.15 + (i % 2) * 1.75, y: 1.6 + Math.floor(i / 2) * 2.2, w: 1.5, h: 1.95, rectRadius: 0.1,
        fill: { color: C.white, transparency: 12 }, line: { type: "none" },
      });
    }
  }

  s.addText("COMPUTER VISION SEMINAR · 2026", {
    x: 0.9, y: 1.25, w: 7.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent, charSpacing: 2,
  });
  s.addText(
    [
      { text: "IntentCard\n", options: { color: C.fg } },
      { text: "디자인 의도를 통제 가능하게", options: { color: C.accent } },
    ],
    { x: 0.9, y: 1.9, w: 7.5, h: 2.0, fontFace: FONT, fontSize: 40, bold: true, lineSpacing: 48, align: "left" }
  );
  s.addText(
    "비전공자(소상공인)가 강력한 이미지 생성 모델을 자기 의도대로 통제해 카드뉴스를 만들도록 돕는 RAG + 멀티에이전트 컴퓨터 비전 시스템",
    { x: 0.9, y: 3.95, w: 7.4, h: 1.0, fontFace: FONT, fontSize: 15, color: C.muted, lineSpacing: 24 }
  );
  chips(s, ["RAG 검색기반 생성", "Diffusion 배경생성", "Vision 비평 루프", "LangGraph", "CLIP · ΔE 평가"], 0.9, 5.15, 7.3);
  s.addText("Hyunmin Han · 기획 · 풀스택 · 연구", { x: 0.9, y: 6.55, w: 6, h: 0.3, fontFace: FONT, fontSize: 12, color: C.muted });
  s.addText("2026", { x: 7.0, y: 6.55, w: 1.3, h: 0.3, fontFace: FONT, fontSize: 12, color: C.dim, align: "right" });
})();

// ===========================================================================
// SLIDE 2 — 한 줄 요지 / 문제 재정의
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Positioning · 한 줄 요지");
  title(s, [
    { text: "더 강한 모델이 아니라, ", options: { color: C.fg } },
    { text: "강한 모델을 ‘통제’", options: { color: C.accent } },
    { text: "하는 문제", options: { color: C.fg } },
  ]);

  // 잘못된 프레임 vs 진짜 문제
  card(s, 0.9, 2.5, 5.6, 3.5, C.bg2, C.bad);
  s.addText("처음 가설 (틀린 프레임)", { x: 1.2, y: 2.7, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.bad });
  s.addText([
    { text: "“모델이 한글/이미지를 못 만든다”\n", options: { bold: true, color: C.fg } },
    { text: "\n· GPT-4.1-mini 파인튜닝 시도\n· 그래도 GPT-5.5 플래그십을 능가 못함\n· 모델 성능 경쟁은 우리가 이길 싸움이 아님", options: { color: C.muted } },
  ], { x: 1.2, y: 3.2, w: 5.0, h: 2.6, fontFace: FONT, fontSize: 13, lineSpacing: 22 });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.0, y: 2.5, w: 5.4, h: 3.5, rectRadius: 0.14, fill: { color: C.panel }, line: { color: C.good, width: 1.5 },
  });
  s.addText("재정의한 진짜 문제", { x: 7.3, y: 2.7, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.good });
  s.addText([
    { text: "gpt-image-2는 이미 잘 만든다.\n진짜 문제는 ‘통제 가능성’\n", options: { bold: true, color: C.fg } },
    { text: "\n(i) 브랜드 폰트·자간·색을 강제 못함\n(ii) 생성 후 텍스트 편집 불가(래스터)\n(iii) 같은 입력에도 결과가 달라 신뢰성↓", options: { color: C.accent2 } },
  ], { x: 7.3, y: 3.2, w: 4.9, h: 2.6, fontFace: FONT, fontSize: 13, lineSpacing: 22 });

  s.addText("→ 경쟁 프레임을 ‘품질(quality)’이 아니라 ‘통제(control)’로 고정한다.", {
    x: 0.9, y: 6.15, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 13, italic: true, color: C.muted,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 3 — 유저 리서치 / 수요 검증
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "User Research · 수요 검증");
  title(s, [
    { text: "“디자이너 없이 매주 콘텐츠를 올려야 하는” ", options: { color: C.fg } },
    { text: "실수요", options: { color: C.accent } },
  ]);

  const stats = [
    { n: "13만+", l: "Threads 조회수로\n검증한 시장 반응" },
    { n: "5곳", l: "가게 3 · 보험 영업 2\n소상공인 협업" },
    { n: "45+8", l: "크롤링 38 + 협업/생성\n실제 카드뉴스 데이터" },
  ];
  stats.forEach((st, i) => {
    const x = 0.9 + i * 3.95;
    card(s, x, 2.7, 3.7, 1.95);
    s.addText(st.n, { x: x + 0.3, y: 2.9, w: 3.1, h: 0.85, fontFace: FONT, fontSize: 34, bold: true, color: C.accent });
    s.addText(st.l, { x: x + 0.3, y: 3.8, w: 3.1, h: 0.8, fontFace: FONT, fontSize: 12, color: C.muted, lineSpacing: 16 });
  });

  s.addText("관찰된 핵심 통점", { x: 0.9, y: 5.0, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent2 });
  s.addText([
    { text: "“신뢰감 있게 · 프리미엄하게 · 20대 타깃” — 의도는 분명한데 손으로 못 옮김", options: { bullet: { code: "25B8", indent: 16 }, color: C.fg } },
    { text: "외주·툴 학습 비용이 부담되는 1인 운영 단위가 반복 제작에 막힘", options: { bullet: { code: "25B8", indent: 16 }, color: C.fg } },
  ], { x: 0.9, y: 5.45, w: 11.5, h: 1.1, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.4 });
  footer(s);
})();

// ===========================================================================
// SLIDE 4 — CV 선행연구 (핵심)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Related Work · 컴퓨터 비전 선행연구");
  title(s, [
    { text: "레이아웃 생성 · 이미지 내 텍스트 · 검색기반 생성", options: { color: C.fg } },
  ], { fontSize: 26 });

  const groups = [
    {
      h: "콘텐츠 인지 레이아웃 생성", c: C.accent,
      rows: [
        ["PosterLayout (CVPR’23)", "content-aware 레이아웃 벤치마크·지표"],
        ["RALF (CVPR’24)", "Retrieval-Augmented Layout — 우리 RAG의 학술 근거"],
        ["CGL / PDA-GAN", "image-aware 배치 (소실영역 회피)"],
        ["SEGA (ICCV’25)", "최신 content-aware 레이아웃 baseline"],
      ],
    },
    {
      h: "이미지 내 텍스트 렌더링", c: C.purple,
      rows: [
        ["GlyphControl / TextDiffuser", "확산모델 글자 렌더 제어"],
        ["AnyText", "다국어 텍스트 생성/편집 (한글 baseline)"],
        ["DSF (Design Sequence)", "logo→text→underlay 디자인 순서 모델링"],
        ["CLIP (ICML’21)", "임베딩 검색 + CLIPScore 평가 근거"],
      ],
    },
  ];
  groups.forEach((g, gi) => {
    const x = 0.9 + gi * 5.9;
    card(s, x, 2.55, 5.6, 3.95, C.bg2, g.c);
    s.addText(g.h, { x: x + 0.3, y: 2.72, w: 5.0, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: g.c });
    g.rows.forEach((r, i) => {
      const y = 3.25 + i * 0.78;
      s.addText(r[0], { x: x + 0.3, y, w: 5.0, h: 0.35, fontFace: FONT_MONO, fontSize: 11.5, bold: true, color: C.fg });
      s.addText(r[1], { x: x + 0.3, y: y + 0.32, w: 5.0, h: 0.4, fontFace: FONT, fontSize: 11, color: C.muted });
    });
  });
  s.addText("원칙: 1차 논문만 인용 — 온라인 강의는 스킬 습득용, 인용 소스 아님.", {
    x: 0.9, y: 6.6, w: 11.5, h: 0.3, fontFace: FONT, fontSize: 10.5, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 5 — 데이터셋 구축
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Dataset · 카드뉴스 데이터 구축");
  title(s, [
    { text: "실제 인스타 디자인을 임베딩한 ", options: { color: C.fg } },
    { text: "‘디자인 DNA’ 코퍼스", options: { color: C.accent } },
  ]);

  const items = [
    ["크롤링 38개", "@sosohanscenery 등 실제 운영 계정의 카드뉴스"],
    ["협업 수집", "가게 3곳 · 보험 영업 2명 등 소상공인 실물 전달"],
    ["GPT 생성 8개", "ChatGPT 기반 카드뉴스 시드"],
    ["45개 임베딩 인덱스", "text-embedding-3-large → pgvector / numpy 검색"],
  ];
  items.forEach((it, i) => {
    const y = 2.7 + i * 0.82;
    card(s, 0.9, y, 6.9, 0.7, C.bg2);
    s.addText(it[0], { x: 1.2, y, w: 2.4, h: 0.7, fontFace: FONT, fontSize: 13, bold: true, color: C.accent2, valign: "middle" });
    s.addText(it[1], { x: 3.6, y, w: 4.1, h: 0.7, fontFace: FONT, fontSize: 11.5, color: C.muted, valign: "middle" });
  });

  // 샘플 썸네일 그리드 (있으면)
  const refs = (() => {
    try {
      return fs.readdirSync(img("public/saved-refs")).filter((f) => /\.(jpg|png)$/i.test(f)).slice(0, 6);
    } catch { return []; }
  })();
  if (refs.length) {
    s.addText("샘플 레퍼런스", { x: 8.1, y: 2.55, w: 4.3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.accent2 });
    refs.forEach((f, i) => {
      const gx = 8.1 + (i % 3) * 1.5;
      const gy = 2.95 + Math.floor(i / 3) * 1.6;
      s.addImage({ path: img("public/saved-refs/" + f), x: gx, y: gy, w: 1.35, h: 1.45 });
    });
  }
  s.addText("재현성 원칙: DATABASE_URL 비운 로컬 numpy 모드 + 고정 seed로 N회 반복 측정.", {
    x: 0.9, y: 6.25, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 11, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 6 — 프롬프트 설계 (구조 vs 금지)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Prompt Design · 합성 통제");
  title(s, [
    { text: "Image1=디자인 고정, Image2=제품만 — ", options: { color: C.fg } },
    { text: "구조를 강제", options: { color: C.accent } },
  ], { fontSize: 26 });

  card(s, 0.9, 2.55, 5.6, 4.0, C.bg2, C.accent);
  s.addText("Image 1 — 디자인을 통제", { x: 1.2, y: 2.72, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
  s.addText(
    ["배경", "레이아웃", "타이포 배치", "그래픽 요소", "프로모션 배지", "색·조명·구도", "카메라 앵글·광고 스타일"].map((t) => ({
      text: t, options: { bullet: { code: "25CF", indent: 14 }, color: C.fg },
    })),
    { x: 1.25, y: 3.2, w: 5.0, h: 3.2, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.25 }
  );

  card(s, 7.0, 2.55, 5.4, 4.0, C.bg2, C.bad);
  s.addText("Image 2 — 제품만 (그 외 전부 금지)", { x: 7.3, y: 2.72, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.bad });
  s.addText(
    [
      "배경 완전 제거 → 제품만 추출·합성",
      "새 광고 디자인 생성 금지",
      "레이아웃·배경 재설계 금지",
      "타이포/배지 위치 변경 금지",
      "시각적 위계 변경 금지",
      "충돌 시 항상 Image 1을 따른다",
    ].map((t) => ({ text: t, options: { bullet: { code: "2715", indent: 14 }, color: C.fg } })),
    { x: 7.35, y: 3.2, w: 4.9, h: 3.2, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.3 }
  );
  footer(s);
})();

// ===========================================================================
// SLIDE 7 — 핵심 CV 기법: 배경/타이포 분리
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Core CV · 배경 생성 + 타이포 분리");
  title(s, [
    { text: "확산모델은 ", options: { color: C.fg } },
    { text: "글자 없는 배경", options: { color: C.accent } },
    { text: "만, 한글은 CSS로 오버레이", options: { color: C.fg } },
  ], { fontSize: 25 });

  if (has("scratch/diffusion_explained.png")) {
    s.addImage({ path: img("scratch/diffusion_explained.png"), x: 7.5, y: 2.5, w: 4.9, h: 3.56 });
    s.addText("확산모델 디노이징 과정", { x: 7.5, y: 6.08, w: 4.9, h: 0.3, fontFace: FONT, fontSize: 10, color: C.dim, align: "center" });
  }

  s.addText([
    { text: "문제: 확산모델이 한글을 ‘구우면’ 헛글자(glyph 깨짐)\n", options: { bold: true, color: C.fg } },
    { text: "→ GlyphControl/AnyText 계열도 한글 신뢰성 한계\n\n", options: { color: C.muted } },
    { text: "해결(구조적 분리):\n", options: { bold: true, color: C.good } },
    { text: "1) gpt-image-2 → 텍스트 없는 배경만 생성\n2) 한국어 카피는 브라우저 CSS 타이포로 오버레이\n3) Fabric.js 캔버스로 사람이 정밀 편집\n", options: { color: C.accent2 } },
    { text: "\n효과: 브랜드 색 0오차 · 즉시 편집 · 결정적 재현", options: { bold: true, color: C.fg } },
  ], { x: 0.9, y: 2.55, w: 6.3, h: 4.0, fontFace: FONT, fontSize: 13, lineSpacing: 20 });
  footer(s);
})();

// ===========================================================================
// SLIDE 8 — 레이아웃 분석 (Upstage) + 모델 변천
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Layout Analysis · 레이어 분리");
  title(s, [
    { text: "텍스트 / 배경 레이어를 ", options: { color: C.fg } },
    { text: "분해", options: { color: C.accent } },
    { text: "해 편집 가능하게", options: { color: C.fg } },
  ]);

  pipeline(s, [
    { sub: "Input", t: "생성된\n카드뉴스" },
    { sub: "gpt-4.1", t: "초기 시도\n(성능 한계)" },
    { sub: "gpt-5.5", t: "이미지 분석\n미지원" },
    { sub: "Upstage", t: "Layout\nAnalyzer", hot: true },
    { sub: "Output", t: "레이어 분리\n→ 편집" },
  ], 2.7, 1.9, 2.2, 0.28);

  s.addText([
    { text: "접근 변천: ", options: { bold: true, color: C.fg } },
    { text: "gpt-4.1(레이어 인식 약함) → gpt-5.5(텍스트는 강하나 비전 분석 미제공) → ", options: { color: C.muted } },
    { text: "Upstage Layout Analyzer로 문서 레이아웃을 검출", options: { color: C.accent2 } },
    { text: " 해 텍스트/배경 박스를 구조화.", options: { color: C.muted } },
  ], { x: 0.9, y: 5.0, w: 11.5, h: 1.0, fontFace: FONT, fontSize: 13, lineSpacing: 22 });
  s.addText("→ 합성 결과를 ‘읽고’ 다시 편집 가능한 객체로 되돌리는 것이 CV 파트의 난제.", {
    x: 0.9, y: 6.15, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 9 — RAG + LangGraph 멀티에이전트 (시스템 핵심)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "System · RAG + 멀티에이전트 self-correction");
  title(s, [
    { text: "검색으로 근거 잡고, ", options: { color: C.fg } },
    { text: "비전 비평으로 스스로 고치는", options: { color: C.accent } },
    { text: " 그래프", options: { color: C.fg } },
  ], { fontSize: 25 });

  pipeline(s, [
    { sub: "GPT-5.5", t: "planner\n슬라이드 분해" },
    { sub: "RAG", t: "retriever\n유사 디자인 검색", hot: true },
    { sub: "GPT-5.5", t: "copywriter\n카피 생성" },
    { sub: "GPT-5.5", t: "designer\n아트디렉션" },
    { sub: "gpt-image-2", t: "image_gen\n배경 렌더" },
  ], 2.55, 1.8, 2.2, 0.22);

  // 피드백 루프 강조
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.9, y: 4.7, w: 7.4, h: 1.7, rectRadius: 0.12, fill: { color: C.panel }, line: { color: C.purple, width: 1.5 },
  });
  s.addText("자기수정 사이클 (LangGraph cycle)", { x: 1.2, y: 4.85, w: 7, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.purple });
  s.addText([
    { text: "art_director(GPT-5.2 vision)", options: { bold: true, color: C.fg } },
    { text: " 가 가독성·대비·위계·한글 타이포·브랜드·아티팩트를 채점 → ", options: { color: C.muted } },
    { text: "reviser → designer", options: { bold: true, color: C.accent2 } },
    { text: " 로 되돌아가 임계점수까지 재생성. 슬라이드는 Send API로 ", options: { color: C.muted } },
    { text: "fan-out 병렬", options: { bold: true, color: C.good } },
    { text: ".", options: { color: C.muted } },
  ], { x: 1.2, y: 5.25, w: 6.9, h: 1.05, fontFace: FONT, fontSize: 12, lineSpacing: 18 });

  card(s, 8.5, 4.7, 3.9, 1.7, C.bg2);
  s.addText("왜 단순 프롬프트 체인이 아닌가", { x: 8.75, y: 4.85, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: C.accent2 });
  s.addText([
    { text: "· 사이클(피드백 루프)이 있음\n· 실제 벡터검색으로 근거 grounding\n· 비전 비평으로 품질을 ‘측정’", options: { color: C.fg } },
  ], { x: 8.75, y: 5.25, w: 3.5, h: 1.05, fontFace: FONT, fontSize: 11.5, lineSpacing: 17 });
  footer(s);
})();

// ===========================================================================
// SLIDE 10 — 시스템 아키텍처 (2-서비스)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Architecture · 2-서비스");
  title(s, [
    { text: "프레젠테이션과 AI 오케스트레이션의 ", options: { color: C.fg } },
    { text: "역할 분리", options: { color: C.accent } },
  ]);

  card(s, 0.9, 2.7, 5.4, 2.6, C.bg2);
  s.addText("Next.js 앱", { x: 1.2, y: 2.9, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.accent });
  s.addText([
    "UI · Auth · Prisma · DB",
    "Fabric.js 캔버스 렌더/편집",
    "SSE 패스스루(agent-generate)",
  ].map((t) => ({ text: t, options: { bullet: { code: "25B8", indent: 14 }, color: C.fg } })),
    { x: 1.25, y: 3.4, w: 5.0, h: 1.8, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.35 });

  card(s, 7.0, 2.7, 5.4, 2.6, C.bg2, C.purple);
  s.addText("agent-service (Python)", { x: 7.3, y: 2.9, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.purple });
  s.addText([
    "FastAPI + LangGraph StateGraph",
    "planner→retriever→…→art_director",
    "node-by-node 이벤트 스트리밍",
  ].map((t) => ({ text: t, options: { bullet: { code: "25B8", indent: 14 }, color: C.fg } })),
    { x: 7.35, y: 3.4, w: 5.0, h: 1.8, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.35 });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.9, y: 5.5, w: 11.5, h: 0.95, rectRadius: 0.1, fill: { color: C.panel }, line: { color: C.line, width: 1 },
  });
  s.addText([
    { text: "공유 인프라  ", options: { bold: true, color: C.accent2 } },
    { text: "Postgres(Neon) · pgvector 인덱스 · gpt-image-2 / GPT-5.5 / GPT-5.2  ", options: { color: C.fg } },
    { text: "— 모든 노드는 키 없이도 도는 결정적 폴백 보유(오프라인 데모/테스트).", options: { color: C.muted } },
  ], { x: 1.2, y: 5.5, w: 11.0, h: 0.95, fontFace: FONT, fontSize: 12.5, valign: "middle", lineSpacing: 18 });
  footer(s);
})();

// ===========================================================================
// SLIDE 11 — 평가 자동화 ⭐ (질문 반영)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Evaluation · ‘눈으로 보던 것’을 자동화");
  title(s, [
    { text: "주관적 품질을 ", options: { color: C.fg } },
    { text: "측정 가능한 프록시", options: { color: C.accent } },
    { text: "로 분해", options: { color: C.fg } },
  ], { fontSize: 26 });

  const rows = [
    ["브랜드 색 일치", "CIEDE2000 ΔE (지정 HEX↔샘플색)", "구현됨", C.good],
    ["재현성", "동일 입력 N회 렌더 픽셀 분산", "구현됨", C.good],
    ["편집 비용", "1글자 수정 시간·재생성 횟수 로그", "구현됨", C.good],
    ["텍스트 충실도", "OCR로 헛글자 검출 + 의도 카피와 CER/WER", "다음 단계", C.accent],
    ["의도 정합", "CLIPScore(의도텍스트 ↔ 결과 이미지)", "훅 준비", C.accent],
    ["레이아웃 품질", "PosterLayout 지표(overlap·정렬·소실영역)", "후보", C.purple],
    ["종합 미학", "LLM-as-judge(art_director) ↔ 사람 평가 상관 검증", "핵심", C.accent],
  ];
  rows.forEach((r, i) => {
    const y = 2.55 + i * 0.6;
    card(s, 0.9, y, 11.5, 0.5, C.bg2);
    s.addText(r[0], { x: 1.15, y, w: 2.6, h: 0.5, fontFace: FONT, fontSize: 12.5, bold: true, color: C.fg, valign: "middle" });
    s.addText(r[1], { x: 3.8, y, w: 6.7, h: 0.5, fontFace: FONT, fontSize: 11.5, color: C.muted, valign: "middle" });
    s.addShape(pptx.ShapeType.roundRect, { x: 10.65, y: y + 0.1, w: 1.5, h: 0.3, rectRadius: 0.15, fill: { color: r[3] }, line: { type: "none" } });
    s.addText(r[2], { x: 10.65, y: y + 0.1, w: 1.5, h: 0.3, fontFace: FONT, fontSize: 9.5, bold: true, color: "0E0E14", align: "center", valign: "middle" });
  });

  s.addText([
    { text: "핵심 아이디어: ", options: { bold: true, color: C.accent } },
    { text: "비전 LLM 심사위원의 점수를 ‘사람 골드 라벨과의 상관계수’로 검증하면, 자동 점수가 사람 눈을 대체할 수 있음을 입증 — 그 심사위원을 그대로 self-correction 루프의 보상으로 재사용한다. (scripts/measure_control.py)", options: { color: C.fg } },
  ], { x: 0.9, y: 6.78, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 11, lineSpacing: 15 });
  footer(s);
})();

// ===========================================================================
// SLIDE 11.5 — Human-in-the-loop (사람 평가 → 학습)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Human-in-the-loop · 사람 평가를 성능으로");
  title(s, [
    { text: "사람의 별점이 ", options: { color: C.fg } },
    { text: "같은 self-correction 루프", options: { color: C.accent } },
    { text: "를 돌린다", options: { color: C.fg } },
  ], { fontSize: 25 });

  pipeline(s, [
    { sub: "Human", t: "별점 + 코멘트", hot: true },
    { sub: "human_critic", t: "critique로\n변환" },
    { sub: "reviser", t: "수정 지시" },
    { sub: "designer→img", t: "재생성" },
    { sub: "art_director", t: "자동 재채점" },
  ], 2.55, 1.8, 2.2, 0.22);

  const outs = [
    { h: "① 즉시 반영", c: C.good, rows: ["POST /revise → 그 카드만 재생성", "auto_score before→after 노출"] },
    { h: "② 수집", c: C.accent, rows: ["feedback_store JSONL (DB 불필요)", "편집비용·선호 데이터 적재"] },
    { h: "③ 향후 개선", c: C.purple, rows: ["retriever 선호 재랭킹", "auto↔human 상관으로 자동평가 검증"] },
  ];
  outs.forEach((g, i) => {
    const x = 0.9 + i * 3.95;
    card(s, x, 4.65, 3.7, 1.85, C.bg2, g.c);
    s.addText(g.h, { x: x + 0.3, y: 4.8, w: 3.1, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: g.c });
    s.addText(g.rows.map((t) => ({ text: t, options: { bullet: { code: "25B8", indent: 12 }, color: C.fg } })),
      { x: x + 0.3, y: 5.25, w: 3.1, h: 1.15, fontFace: FONT, fontSize: 11, lineSpacingMultiple: 1.3 });
  });

  s.addText("핵심: art_director 자동 점수를 사람 점수와 상관(Pearson/Spearman)으로 검증 → 자동 평가가 사람 눈을 대체할 수 있음을 입증하고, 그 심사위원을 그대로 루프 보상으로 재사용.", {
    x: 0.9, y: 6.62, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 10.5, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 12 — 개선할 점 (한계)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Limitations · 개선할 점");
  title(s, [{ text: "정직한 한계와 다음 과제", options: { color: C.fg } }]);

  const cols = [
    { h: "모델", c: C.accent, rows: ["Qwen 최신 모델이 GPT 능가(영어)", "한국어에서도 그럴지 검증 필요", "태스크별 모델 env로 교체 가능하게 설계됨"] },
    { h: "저작권·데이터", c: C.purple, rows: ["합성 시 원본 디자인 저작권 이슈", "라이선스 명확한 데이터셋 확대 필요", "생성-합성 경계의 권리 정리"] },
    { h: "기능 안정성", c: C.bad, rows: ["다중 칸 중 한 곳만 합성 적용되는 버그", "동시 다중 사진 첨부 불가", "주제 문구가 합성에 반영 안 되는 현상"] },
  ];
  cols.forEach((g, i) => {
    const x = 0.9 + i * 3.95;
    card(s, x, 2.6, 3.7, 3.6, C.bg2, g.c);
    s.addText(g.h, { x: x + 0.3, y: 2.8, w: 3.1, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: g.c });
    s.addText(g.rows.map((t) => ({ text: t, options: { bullet: { code: "25B8", indent: 14 }, color: C.fg } })),
      { x: x + 0.3, y: 3.35, w: 3.1, h: 2.7, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.35 });
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 13 — 향후 연구: A2A / MCP ⭐ (질문 반영)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Future · A2A / MCP 연구 가능성");
  title(s, [
    { text: "통제 가능한 생성 파이프라인을 ", options: { color: C.fg } },
    { text: "표준 프로토콜로 노출", options: { color: C.accent } },
  ], { fontSize: 25 });

  card(s, 0.9, 2.55, 5.6, 3.6, C.bg2, C.accent);
  s.addText("MCP — 도구·자원의 표준화", { x: 1.2, y: 2.72, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
  s.addText([
    "이미 .mcp.json 사용 중 — 자연 확장",
    "생성·편집·평가를 MCP tool로 노출",
    "브랜드 가이드·폰트·템플릿 DB를 resource로",
    "외부 에이전트가 표준 호출로 ‘의도 통제’ 사용",
    "기여: 디자인 통제를 도구 인터페이스로 형식화",
  ].map((t) => ({ text: t, options: { bullet: { code: "25B8", indent: 14 }, color: C.fg } })),
    { x: 1.25, y: 3.25, w: 5.05, h: 2.8, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.3 });

  card(s, 7.0, 2.55, 5.4, 3.6, C.bg2, C.purple);
  s.addText("A2A — 에이전트 간 협업", { x: 7.3, y: 2.72, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.purple });
  s.addText([
    "지금은 한 그래프 안의 노드들",
    "planner/designer/critic을 독립 에이전트로 분리",
    "RQ: 분산 비평-수정 루프의 품질·비용·수렴",
    "human-in-the-loop: 사람 디자이너 에이전트 협업",
    "솔직히: CV 알고리즘 기여 아님 → 시스템/HCI 트랙",
  ].map((t, i) => ({ text: t, options: { bullet: { code: "25B8", indent: 14 }, color: i === 4 ? C.muted : C.fg } })),
    { x: 7.35, y: 3.25, w: 4.85, h: 2.8, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.3 });

  s.addText("정직한 평가: A2A/MCP는 ‘통제 가능 생성’을 인프라로 확장하는 시스템 기여 — UIST/데모·평가 자동화의 받침대이지, CV 비전 논문의 주축은 아님.", {
    x: 0.9, y: 6.3, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 11, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 14 — Closing
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W * 0.55, h: 0.09, fill: { color: C.accent }, line: { type: "none" } });
  s.addShape(pptx.ShapeType.rect, { x: W * 0.55, y: 0, w: W * 0.45, h: 0.09, fill: { color: C.purple }, line: { type: "none" } });
  s.addText("품질이 아니라 통제로 경쟁한다", {
    x: 0.9, y: 2.1, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: C.accent, align: "center",
  });
  s.addText([
    { text: "비전공자의 디자인 의도를\n", options: { color: C.fg } },
    { text: "통제 가능하게 실현한다", options: { color: C.accent } },
  ], { x: 0.9, y: 2.8, w: 11.5, h: 1.8, fontFace: FONT, fontSize: 38, bold: true, align: "center", lineSpacing: 48 });
  s.addText("RAG 그라운딩 · 비전 자기수정 · 배경/타이포 분리 · 정량 평가 자동화", {
    x: 0.9, y: 4.8, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 14, color: C.muted, align: "center",
  });
  chips(s, ["PosterLayout", "RALF", "CLIPScore", "CIEDE2000", "LangGraph", "gpt-image-2"], 3.0, 5.6, 7.3);
  s.addText("Hyunmin Han · 2026 · 감사합니다 🙌", {
    x: 0.9, y: 6.7, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.dim, align: "center",
  });
})();

// ---- Write -----------------------------------------------------------------
const outPath = path.join(ROOT, "scratch", "intentcard-cv-presentation.pptx");
pptx.writeFile({ fileName: outPath }).then((f) => {
  console.log("✅ 생성 완료:", f);
});
