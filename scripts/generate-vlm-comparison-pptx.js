/**
 * VLM 선정 & 구현 발표 자료 생성 스크립트
 *
 * 실행: node scripts/generate-vlm-comparison-pptx.js
 * 출력: scratch/vlm-selection-presentation.pptx
 *
 * 목적: 교수님/팀 발표용 — AI 카드뉴스 서비스에 쓸 VLM(Vision-Language Model)을
 *      후보(DeepSeek-VL · Llama Vision · Qwen3-VL · GPT-5.5)와 비교·선정하고,
 *      "인식(OCR/레이아웃) vs 취향(미적 판단)" 관점에서 하이브리드 전략을 세운 뒤,
 *      실제로 코드에 반영한 내용(art_director 루브릭 · eval 하니스 · analyze_reference)을
 *      정리한다. (대화 기록 기반)
 */

const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Hyunmin Han";
pptx.company = "carnews-insta";
pptx.subject = "VLM 모델 비교 · 선정 · 구현";
pptx.title = "AI 카드뉴스 서비스를 위한 VLM 선정과 구현";

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
  accent2: "FFB088",
  purple: "A855F7",
  blue: "5B9DF9",
  good: "5AD19A",
  warn: "F4C152",
  bad: "F2727B",
  white: "FFFFFF",
};
const FONT = "Pretendard";
const MONO = "Consolas";

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

function title(slide, text, opts = {}) {
  slide.addText(text, {
    x: 0.9, y: 1.0, w: 11.5, h: 1.0,
    fontFace: FONT, fontSize: opts.fontSize || 30, bold: true,
    color: C.fg, lineSpacing: opts.lineSpacing || 36, align: "left",
  });
}

let _page = 1;
function footer(slide) {
  _page += 1;
  const page = String(_page).padStart(2, "0");
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.9, y: 6.94, w: 0.35, h: 0.05, fill: { color: C.accent }, line: { type: "none" },
  });
  slide.addText("VLM 선정·구현 발표 · AI 카드뉴스", {
    x: 0.9, y: 7.02, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, align: "left",
  });
  slide.addText(page, {
    x: 10.4, y: 7.02, w: 2.0, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, align: "right",
  });
}

function card(slide, x, y, w, h, fill = C.bg2) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: C.line, width: 1 },
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
  const names = ["DeepSeek-VL", "Llama Vision", "Qwen3-VL", "GPT-5.5"];
  names.forEach((n, i) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: 9.15 + (i % 2) * 1.75, y: 1.7 + Math.floor(i / 2) * 2.1, w: 1.6, h: 1.85,
      rectRadius: 0.1, fill: { color: C.white, transparency: 14 }, line: { type: "none" },
    });
    s.addText(n, {
      x: 9.15 + (i % 2) * 1.75, y: 1.7 + Math.floor(i / 2) * 2.1, w: 1.6, h: 1.85,
      fontFace: FONT, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle",
    });
  });

  s.addText("VISION-LANGUAGE MODEL · 선정과 구현", {
    x: 0.9, y: 1.25, w: 7.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent, charSpacing: 2,
  });
  s.addText("AI 카드뉴스 서비스를 위한\nVLM 선정과 구현", {
    x: 0.9, y: 1.9, w: 7.6, h: 2.0, fontFace: FONT, fontSize: 40, bold: true, color: C.fg, lineSpacing: 46,
  });
  s.addText("\"한국어 텍스트를 읽고 레이아웃을 설명하는\" 모델은 무엇인가?\n인식(OCR) vs 취향(미적 판단)을 나눠 보는 하이브리드 전략", {
    x: 0.9, y: 4.2, w: 7.5, h: 1.0, fontFace: FONT, fontSize: 15, color: C.muted, lineSpacing: 24,
  });
  s.addText([
    { text: "발표자 · Hyunmin Han", options: { color: C.fg, bold: true } },
    { text: "   |   2026", options: { color: C.dim } },
  ], { x: 0.9, y: 6.2, w: 7.5, h: 0.4, fontFace: FONT, fontSize: 13 });
})();

// ===========================================================================
// SLIDE 2 — Background: VLM이란 & 우리 서비스에서의 역할
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "01 · Background");
  title(s, "VLM이란? 그리고 우리 서비스에서의 역할");

  const fy = 2.5;
  const boxes = [
    { t: "🖼️ 이미지 입력", sub: "카드 / 레퍼런스", col: C.blue },
    { t: "👁️ VLM", sub: "보고(see) + 추론", col: C.purple },
    { t: "📝 텍스트 출력", sub: "OCR / 비평 / 설명", col: C.good },
  ];
  boxes.forEach((b, i) => {
    const x = 0.9 + i * 3.0;
    card(s, x, fy, 2.5, 1.3, C.panel);
    s.addText(b.t, { x, y: fy + 0.18, w: 2.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: b.col, align: "center" });
    s.addText(b.sub, { x, y: fy + 0.7, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted, align: "center" });
    if (i < 2) s.addText("→", { x: x + 2.5, y: fy + 0.3, w: 0.5, h: 0.6, fontFace: FONT, fontSize: 28, color: C.dim, align: "center" });
  });

  card(s, 10.0, fy, 2.45, 1.3, C.bg2);
  s.addText("우리 파이프라인 적용 지점", { x: 10.15, y: fy + 0.12, w: 2.2, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.accent });
  s.addText("• art_director (디자인 비평)\n• 레퍼런스 45종 분석\n• 한국어 텍스트 OCR", { x: 10.15, y: fy + 0.45, w: 2.2, h: 0.8, fontFace: FONT, fontSize: 10.5, color: C.fg, lineSpacing: 15 });

  card(s, 0.9, 4.3, 11.55, 2.0, C.bg2);
  s.addText("핵심 질문", { x: 1.2, y: 4.5, w: 4, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
  s.addText("\"이미지 속 한글 카피를 정확히 읽고(OCR), 레이아웃을 구조화해 설명하는 VLM은 무엇인가?\"", {
    x: 1.2, y: 4.95, w: 11.0, h: 0.8, fontFace: FONT, fontSize: 19, bold: true, color: C.fg, lineSpacing: 26,
  });
  s.addText("현재 서비스는 OpenAI GPT-5.5 비전을 사용 중 → 한국어 특화·비용·통제 관점에서 오픈 대안을 비교한다.", {
    x: 1.2, y: 5.7, w: 11.0, h: 0.5, fontFace: FONT, fontSize: 13, color: C.muted,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 3 — 핵심 통찰: 두 가지 일 (인식 vs 취향)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "02 · Key Insight");
  title(s, "핵심 통찰 — VLM이 하는 '두 가지 일'을 구분하라");

  // 좌: 인식 / 우: 취향
  card(s, 0.9, 2.45, 5.7, 3.5, "11233A");
  s.addShape(pptx.ShapeType.rect, { x: 0.9, y: 2.45, w: 5.7, h: 0.1, fill: { color: C.blue }, line: { type: "none" } });
  s.addText("① 인식 (Perception)", { x: 1.2, y: 2.7, w: 5.1, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.blue });
  s.addText("\"한글 텍스트를 읽고 레이아웃을 설명\"", { x: 1.2, y: 3.25, w: 5.1, h: 0.4, fontFace: FONT, fontSize: 13.5, italic: true, color: C.fg });
  s.addText("• OCR · 위치 · 그리드 · 색 팔레트\n• 정답이 비교적 명확한 작업\n• 오픈 모델이 상용 모델과 대등\n\n→ 최적: Qwen3-VL (오픈, 한국어 OCR 최강)", {
    x: 1.2, y: 3.75, w: 5.1, h: 2.0, fontFace: FONT, fontSize: 13.5, color: C.muted, lineSpacing: 21,
  });

  card(s, 6.75, 2.45, 5.7, 3.5, "2A1633");
  s.addShape(pptx.ShapeType.rect, { x: 6.75, y: 2.45, w: 5.7, h: 0.1, fill: { color: C.purple }, line: { type: "none" } });
  s.addText("② 취향 (Taste)", { x: 7.05, y: 2.7, w: 5.1, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.purple });
  s.addText("\"이 디자인이 아름다운가?\"", { x: 7.05, y: 3.25, w: 5.1, h: 0.4, fontFace: FONT, fontSize: 13.5, italic: true, color: C.fg });
  s.addText("• 미적 판단 · 위계 · 균형 감각\n• 정답이 모호한 주관적 작업\n• 아직 상용(폐쇄) 모델이 우위\n\n→ 최적: GPT-5.5 (취향 판단 최강, 유지)", {
    x: 7.05, y: 3.75, w: 5.1, h: 2.0, fontFace: FONT, fontSize: 13.5, color: C.muted, lineSpacing: 21,
  });

  s.addText("⚡ 이 구분이 전략의 핵심 — 모든 일을 한 모델에 맡기지 않는다. 인식은 오픈(저비용·통제), 취향은 상용(품질).", {
    x: 0.9, y: 6.2, w: 11.55, h: 0.5, fontFace: FONT, fontSize: 13.5, bold: true, color: C.accent2,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 4 — 후보 모델 개요 (Candidates)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "03 · Candidates");
  title(s, "후보 모델 4종 개요");

  const models = [
    { n: "DeepSeek-VL2", tag: '"dipstick"', type: "오픈소스 (MIT)", d: "강력한 OCR·문서 이해. 두 오픈 후보 중 한국어는 Llama보다 우위.", col: C.blue },
    { n: "Llama 3.2 Vision", tag: "11B / 90B", type: "오픈 (제한적)", d: "Meta. 거대한 생태계. 단, 한국어 OCR 약함 + 라이선스 제약.", col: C.accent },
    { n: "Qwen3-VL", tag: "8B / 32B / MoE  ⭐", type: "오픈소스 (Apache-2.0)", d: "32개 언어 OCR(한국어 포함) + 텍스트 바운딩박스 + 문서 파싱. 2.5-VL 대체.", col: C.good },
    { n: "GPT-5.5 (현재)", tag: "Closed API", type: "상용 API", d: "미적 '취향' 판단 최강. 단, 폐쇄형·종량 과금·셀프호스팅 불가.", col: C.purple },
  ];
  models.forEach((m, i) => {
    const y = 2.4 + i * 1.05;
    card(s, 0.9, y, 11.55, 0.92, C.panel);
    s.addShape(pptx.ShapeType.rect, { x: 0.9, y, w: 0.1, h: 0.92, fill: { color: m.col }, line: { type: "none" } });
    s.addText(m.n, { x: 1.2, y: y + 0.12, w: 3.0, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.fg });
    s.addText(m.tag, { x: 1.2, y: y + 0.52, w: 3.0, h: 0.3, fontFace: MONO, fontSize: 11, color: m.col });
    s.addText(m.type, { x: 4.3, y: y + 0.28, w: 2.2, h: 0.4, fontFace: FONT, fontSize: 12.5, bold: true, color: C.muted, valign: "middle" });
    s.addText(m.d, { x: 6.6, y: y + 0.1, w: 5.7, h: 0.72, fontFace: FONT, fontSize: 12.5, color: C.fg, valign: "middle", lineSpacing: 16 });
  });
  s.addText("※ Qwen3-VL은 발표 시점(2026-06) 최신 — 2.5-VL의 10개 → 32개 언어 OCR로 확장, 한국어 인식 향상.", {
    x: 0.9, y: 6.75, w: 11.5, h: 0.35, fontFace: FONT, fontSize: 11, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 5 — 비교 매트릭스 (Scoring Matrix)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "04 · Comparison Matrix");
  title(s, "평가 매트릭스 — 점수 비교 (5점 만점)");

  const cols = ["평가 축", "DeepSeek-VL", "Llama Vision", "Qwen3-VL", "GPT-5.5"];
  const rows = [
    ["한국어 OCR (30%)", "4", "2", "5", "5"],
    ["미적 판단 (25%)", "3", "3", "4", "5"],
    ["파인튜닝 용이성 (15%)", "4", "4", "5", "2"],
    ["라이선스 (10%)", "5", "3", "5", "1"],
    ["비용 / 호스팅 (10%)", "4", "4", "4", "2"],
    ["생태계 (10%)", "3", "5", "4", "5"],
    ["가중 합산 점수", "3.75", "3.15", "4.55", "3.85"],
  ];

  const tableData = [];
  tableData.push(cols.map((c) => ({
    text: c,
    options: { fill: C.bg, color: C.accent, bold: true, fontSize: 13, align: "center", valign: "middle", fontFace: FONT },
  })));

  rows.forEach((r, ri) => {
    const isTotal = ri === rows.length - 1;
    tableData.push(r.map((cell, ci) => {
      let color = C.fg;
      if (ci > 0 && !isTotal) {
        const v = Number(cell);
        color = v >= 5 ? C.good : v >= 4 ? C.accent2 : v >= 3 ? C.warn : C.bad;
      }
      if (isTotal && ci > 0) {
        color = cell === "4.55" ? C.good : C.fg;
      }
      return {
        text: cell,
        options: {
          fill: isTotal ? "23233A" : (ci === 0 ? C.panel : C.bg2),
          color: ci === 0 ? C.fg : color,
          bold: isTotal || ci === 0,
          fontSize: isTotal ? 14 : 13,
          align: ci === 0 ? "left" : "center",
          valign: "middle",
          fontFace: FONT,
        },
      };
    }));
  });

  s.addTable(tableData, {
    x: 0.9, y: 2.35, w: 11.55,
    colW: [3.35, 2.05, 2.05, 2.05, 2.05],
    rowH: [0.5, 0.5, 0.5, 0.5, 0.45, 0.45, 0.45, 0.6],
    border: { type: "solid", color: C.line, pt: 1 },
  });
  s.addText("● 색상: 초록=우수(5) · 주황=양호(4) · 노랑=보통(3) · 빨강=취약(≤2)   |   Qwen3-VL이 가중 합산 4.55로 최고", {
    x: 0.9, y: 6.55, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 6 — 호스팅 현실: Railway = CPU, GPU 직접 운영 불필요
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "05 · Hosting Reality");
  title(s, "오해 정리 — \"GPU를 직접 빌려야 하나?\" 아니오");

  s.addText("우리는 Railway(CPU 컨테이너)로 self-host 중. Railway엔 GPU가 없지만 — 괜찮다. 오케스트레이터는 모델을 'API로 호출'만 한다.", {
    x: 0.9, y: 2.05, w: 11.55, h: 0.6, fontFace: FONT, fontSize: 13.5, color: C.muted, lineSpacing: 19,
  });

  const opts = [
    { n: "A. GPT-5.5 유지", who: "OpenAI", gpu: "GPU 신경 안 씀", eff: "노력 ⭐", d: "이미 연동됨", col: C.purple },
    { n: "B. Qwen3-VL · 호스팅 API", who: "Together / OpenRouter", gpu: "GPU 신경 안 씀", eff: "노력 ⭐⭐", d: "base_url + 키만 교체", col: C.good },
    { n: "C. 직접 셀프호스팅", who: "Replicate / Modal / RunPod", gpu: "GPU 직접 임대 ✅", eff: "노력 ⭐⭐⭐⭐", d: "선택사항 (대용량 시)", col: C.warn },
  ];
  opts.forEach((o, i) => {
    const x = 0.9 + i * 3.9;
    card(s, x, 2.85, 3.6, 2.6, C.panel);
    s.addShape(pptx.ShapeType.rect, { x, y: 2.85, w: 3.6, h: 0.1, fill: { color: o.col }, line: { type: "none" } });
    s.addText(o.n, { x: x + 0.25, y: 3.05, w: 3.2, h: 0.6, fontFace: FONT, fontSize: 15.5, bold: true, color: C.fg, lineSpacing: 19 });
    s.addText([
      { text: "GPU 주인:  ", options: { color: C.dim } }, { text: o.who + "\n", options: { color: C.fg } },
      { text: "내 GPU 관리:  ", options: { color: C.dim } }, { text: o.gpu + "\n", options: { color: o.col, bold: true } },
      { text: o.eff + "\n", options: { color: C.muted } },
      { text: o.d, options: { color: C.muted, italic: true } },
    ], { x: x + 0.25, y: 3.75, w: 3.2, h: 1.6, fontFace: FONT, fontSize: 11.5, lineSpacing: 18 });
  });

  s.addText("➡  A·B는 GPU가 '내 삶에 없음'. 대부분 B를 선택 — 최고 오픈 한국어 OCR을 OpenAI 호출처럼 쉽게.", {
    x: 0.9, y: 5.75, w: 11.55, h: 0.5, fontFace: FONT, fontSize: 13.5, bold: true, color: C.accent2,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 7 — 결론 / 선정 (Decision) — 하이브리드
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "06 · Decision");
  title(s, "최종 전략 — 하이브리드 (취향=GPT-5.5 · 인식=Qwen3-VL)");

  s.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 2.25, w: 11.55, h: 1.25, rectRadius: 0.12, fill: { color: "134E3A" }, line: { color: C.good, width: 1.5 } });
  s.addText("✅ 인식용 선정 모델", { x: 1.25, y: 2.42, w: 4, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.good });
  s.addText("Qwen3-VL", { x: 1.25, y: 2.74, w: 5, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: C.white });
  s.addText("취향 판단(art_director)은 GPT-5.5 유지 · 한글 OCR/레이아웃은 Qwen3-VL로", {
    x: 6.4, y: 2.42, w: 5.8, h: 1.0, fontFace: FONT, fontSize: 13.5, color: C.fg, valign: "middle", lineSpacing: 19,
  });

  const reasons = [
    { n: "가장 높은 점수", d: "가중 합산 4.55/5 — 한국어 OCR·레이아웃에서 DeepSeek·Llama를 능가", col: C.good },
    { n: "통제 + 저비용", d: "오픈·Apache 라이선스 → 종량 과금 탈피, 데이터 외부 유출 없이 운용", col: C.blue },
    { n: "현실적 하이브리드", d: "주관적 취향은 GPT-5.5, 객관적 인식은 Qwen3-VL — 강점만 조합", col: C.purple },
  ];
  reasons.forEach((r, i) => {
    const x = 0.9 + i * 3.9;
    card(s, x, 3.75, 3.6, 1.95, C.panel);
    s.addShape(pptx.ShapeType.rect, { x, y: 3.75, w: 0.1, h: 1.95, fill: { color: r.col }, line: { type: "none" } });
    s.addText(r.n, { x: x + 0.3, y: 3.95, w: 3.1, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.fg });
    s.addText(r.d, { x: x + 0.3, y: 4.42, w: 3.1, h: 1.2, fontFace: FONT, fontSize: 12.5, color: C.muted, lineSpacing: 18 });
  });

  s.addText([
    { text: "전환 비용  ", options: { color: C.accent, bold: true } },
    { text: "→  코드 변경 0. env 3개(AGENT_ANALYZE_MODEL / _BASE_URL / _API_KEY)만 설정하면 즉시 교체.", options: { color: C.fg } },
  ], { x: 0.9, y: 5.95, w: 11.55, h: 0.5, fontFace: FONT, fontSize: 13 });
  footer(s);
})();

// ===========================================================================
// SLIDE 8 — 실제 구현 (What we shipped)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "07 · What We Shipped");
  title(s, "실제로 코드에 반영한 것 (agent-service)");

  const items = [
    { n: "art_director 루브릭 업그레이드", d: "5축 가중 채점(구도·여백·색무드·완성도·무문자) + Python 결정론적 집계 + 텍스트 게이트. 자기수정 루프의 품질 게이트를 안정·설명가능하게.", col: C.accent },
    { n: "eval 하니스", d: "무키 self-test(CI에서 채점 로직 검증) + 이미지 평가(축별 점수 + 사람 라벨 대비 밴드 정확도). 'good|ok|bad' 매니페스트.", col: C.good },
    { n: "analyze_reference + POST /analyze", d: "레퍼런스 카드 → 한글 텍스트(OCR) + 레이아웃을 구조화 JSON으로. RAG의 'design DNA' 요약을 실제 근거로 채움.", col: C.blue },
    { n: "모델 무관 설계 (Qwen3-VL 전환점)", d: "vision 호출에 model/base_url/api_key 오버라이드 추가 → OpenAI 호환 제공자로 Qwen3-VL 전환. Railway는 CPU 유지.", col: C.purple },
  ];
  items.forEach((it, i) => {
    const y = 2.35 + i * 1.05;
    card(s, 0.9, y, 11.55, 0.92, C.panel);
    s.addShape(pptx.ShapeType.rect, { x: 0.9, y, w: 0.1, h: 0.92, fill: { color: it.col }, line: { type: "none" } });
    s.addText(it.n, { x: 1.2, y: y + 0.13, w: 4.0, h: 0.66, fontFace: FONT, fontSize: 14.5, bold: true, color: C.fg, valign: "middle", lineSpacing: 17 });
    s.addText(it.d, { x: 5.4, y: y + 0.1, w: 6.9, h: 0.72, fontFace: FONT, fontSize: 12, color: C.muted, valign: "middle", lineSpacing: 16 });
  });
  s.addText("테스트 14개 통과 · eval self-test 통과 · PR #44 (branch: claude/vlm-selection-finetuning)", {
    x: 0.9, y: 6.65, w: 11.5, h: 0.35, fontFace: MONO, fontSize: 11, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 9 — 파인튜닝 & 다음 단계 (Fine-tuning / Next)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "08 · Fine-tuning & Next");
  title(s, "파인튜닝은 '나중에' — 지금은 파이프라인이 우선");

  const steps = [
    { n: "1. 데이터 생성", icon: "🧑‍🏫", d: "GPT-5.5가 카드를\n평가·라벨링\n→ '지식 증류'", col: C.blue },
    { n: "2. 학습 (LoRA)", icon: "🎓", d: "모델의 ~1%만 학습\nRTX 4090 1장(24GB)\nLLaMA-Factory", col: C.purple },
    { n: "3. 호스팅·서빙", icon: "🚀", d: "Railway=CPU\n→ GPU 제공자 API로\n호출 (B안)", col: C.good },
    { n: "결과", icon: "💰", d: "큰 모델 행동을\n복제한 작고 저렴한\n전용 모델", col: C.warn },
  ];
  steps.forEach((st, i) => {
    const x = 0.9 + i * 2.95;
    card(s, x, 2.4, 2.7, 2.0, C.panel);
    s.addText(st.icon, { x, y: 2.5, w: 2.7, h: 0.6, fontFace: FONT, fontSize: 28, align: "center" });
    s.addText(st.n, { x, y: 3.1, w: 2.7, h: 0.4, fontFace: FONT, fontSize: 14.5, bold: true, color: st.col, align: "center" });
    s.addText(st.d, { x: x + 0.15, y: 3.52, w: 2.4, h: 0.85, fontFace: FONT, fontSize: 11, color: C.muted, align: "center", lineSpacing: 14 });
    if (i < 3) s.addText("→", { x: x + 2.55, y: 3.05, w: 0.45, h: 0.6, fontFace: FONT, fontSize: 22, color: C.dim, align: "center" });
  });

  card(s, 0.9, 4.65, 5.7, 1.75, C.bg2);
  s.addText("❓ 정말 필요한가?", { x: 1.2, y: 4.8, w: 5, h: 0.4, fontFace: FONT, fontSize: 13.5, bold: true, color: C.accent });
  s.addText("이미 RAG(45 템플릿 few-shot) 구축됨 → RAG + 프롬프트로 ~80% 해결. 파인튜닝은 일관 루브릭/비용 절감이 필요할 때.", {
    x: 1.2, y: 5.2, w: 5.1, h: 1.1, fontFace: FONT, fontSize: 12.5, color: C.fg, lineSpacing: 18,
  });

  card(s, 6.75, 4.65, 5.7, 1.75, C.bg2);
  s.addText("➡ 다음 단계", { x: 7.05, y: 4.8, w: 5, h: 0.4, fontFace: FONT, fontSize: 13.5, bold: true, color: C.good });
  s.addText("① /analyze로 45 레퍼런스 OCR·레이아웃 추출\n② RAG 요약을 실제 'design DNA'로 교체\n③ (선택) GPT-5.5 라벨로 Qwen3-VL LoRA", {
    x: 7.05, y: 5.2, w: 5.1, h: 1.1, fontFace: FONT, fontSize: 12.5, color: C.fg, lineSpacing: 18,
  });
  footer(s);
})();

// ---- Save ------------------------------------------------------------------
pptx.writeFile({ fileName: "scratch/vlm-selection-presentation.pptx" }).then((f) => {
  console.log("✅ 생성 완료:", f);
});
