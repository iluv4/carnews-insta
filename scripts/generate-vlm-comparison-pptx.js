/**
 * VLM 선정 & 파인튜닝 비교 발표 자료 생성 스크립트
 *
 * 실행: node scripts/generate-vlm-comparison-pptx.js
 * 출력: scratch/vlm-model-comparison.pptx
 *
 * 목적: 교수님 발표용 — AI 카드뉴스 서비스에 쓸 VLM(Vision-Language Model)을
 *      여러 후보(DeepSeek-VL · Llama Vision · Qwen2.5-VL · GPT-5.5)와 비교하고,
 *      평가 기준에 따라 한 모델을 선정하는 근거를 제시한다.
 */

const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Hyunmin Han";
pptx.company = "carnews-insta";
pptx.subject = "VLM 모델 비교 및 선정";
pptx.title = "AI 카드뉴스 서비스를 위한 VLM 선정";

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
  slide.addText("VLM 선정 발표 · AI 카드뉴스", {
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
  // 우측 "후보 모델" 카드 4장
  const names = ["DeepSeek-VL", "Llama Vision", "Qwen2.5-VL", "GPT-5.5"];
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

  s.addText("VISION-LANGUAGE MODEL · 모델 선정 연구", {
    x: 0.9, y: 1.25, w: 7.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent, charSpacing: 2,
  });
  s.addText("AI 카드뉴스 서비스를 위한\nVLM 비교 및 선정", {
    x: 0.9, y: 1.9, w: 7.6, h: 2.0, fontFace: FONT, fontSize: 40, bold: true, color: C.fg, lineSpacing: 46,
  });
  s.addText("한국어 디자인 미학을 이해하는 멀티모달 모델은 무엇인가?\nDeepSeek-VL · Llama Vision · Qwen2.5-VL · GPT-5.5 비교", {
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

  // flow
  const fy = 2.5;
  const boxes = [
    { t: "🖼️ 이미지 입력", sub: "카드 / 레퍼런스", col: C.blue },
    { t: "👁️ VLM", sub: "보고(see) + 추론", col: C.purple },
    { t: "📝 텍스트 출력", sub: "비평 / 점수 / 설명", col: C.good },
  ];
  boxes.forEach((b, i) => {
    const x = 0.9 + i * 3.0;
    card(s, x, fy, 2.5, 1.3, C.panel);
    s.addText(b.t, { x, y: fy + 0.18, w: 2.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: b.col, align: "center" });
    s.addText(b.sub, { x, y: fy + 0.7, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted, align: "center" });
    if (i < 2) s.addText("→", { x: x + 2.5, y: fy + 0.3, w: 0.5, h: 0.6, fontFace: FONT, fontSize: 28, color: C.dim, align: "center" });
  });

  // 우리 서비스 적용 지점
  card(s, 10.0, fy, 2.45, 1.3, C.bg2);
  s.addText("우리 서비스 적용 지점", { x: 10.15, y: fy + 0.12, w: 2.2, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.accent });
  s.addText("• art_director (디자인 비평)\n• 레퍼런스 45종 분석\n• 한국어 텍스트 OCR", { x: 10.15, y: fy + 0.45, w: 2.2, h: 0.8, fontFace: FONT, fontSize: 10.5, color: C.fg, lineSpacing: 15 });

  card(s, 0.9, 4.3, 11.55, 2.0, C.bg2);
  s.addText("핵심 질문", { x: 1.2, y: 4.5, w: 4, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
  s.addText("\"한국어 디자인의 미학(aesthetics)을 판단하고, 이미지 속 한글 카피를 정확히 읽어내는 VLM은 무엇인가?\"", {
    x: 1.2, y: 4.95, w: 11.0, h: 0.8, fontFace: FONT, fontSize: 19, bold: true, color: C.fg, lineSpacing: 26,
  });
  s.addText("현재 서비스는 OpenAI GPT-5.5 비전을 사용 중 → 비용·통제·한국어 특화 관점에서 대안을 비교한다.", {
    x: 1.2, y: 5.7, w: 11.0, h: 0.5, fontFace: FONT, fontSize: 13, color: C.muted,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 3 — 평가 기준 (Evaluation Criteria)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "02 · Evaluation Criteria");
  title(s, "무엇을 기준으로 비교하는가 — 6대 평가 축");

  const crit = [
    { n: "한국어 OCR", d: "이미지 속 한글 카피를\n정확히 읽는 능력", col: C.blue, w: "30%" },
    { n: "미적 판단", d: "디자인이 '아름다운지'\n전문가 수준 비평", col: C.purple, w: "25%" },
    { n: "파인튜닝 용이성", d: "LoRA 등으로 우리 데이터에\n맞춰 학습 가능한가", col: C.good, w: "15%" },
    { n: "라이선스", d: "상업적 사용 자유도\n(SaaS 배포 가능)", col: C.accent, w: "10%" },
    { n: "비용 / 호스팅", d: "추론 단가와 셀프호스팅\n난이도", col: C.warn, w: "10%" },
    { n: "생태계", d: "도구·문서·커뮤니티\n성숙도", col: C.accent2, w: "10%" },
  ];
  crit.forEach((c, i) => {
    const x = 0.9 + (i % 3) * 3.9;
    const y = 2.45 + Math.floor(i / 3) * 2.0;
    card(s, x, y, 3.6, 1.75, C.panel);
    s.addShape(pptx.ShapeType.rect, { x: x, y: y, w: 0.1, h: 1.75, fill: { color: c.col }, line: { type: "none" } });
    s.addText(c.n, { x: x + 0.3, y: y + 0.18, w: 2.6, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.fg });
    s.addText(c.w, { x: x + 0.3, y: y + 0.18, w: 3.0, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: c.col, align: "right" });
    s.addText(c.d, { x: x + 0.3, y: y + 0.7, w: 3.1, h: 0.9, fontFace: FONT, fontSize: 12.5, color: C.muted, lineSpacing: 17 });
  });
  s.addText("가중치(%)는 카드뉴스 서비스 특성상 '한국어 텍스트 + 디자인 판단'에 집중하여 설정", {
    x: 0.9, y: 6.5, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.dim,
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
    { n: "DeepSeek-VL2", tag: '"dipstick"', type: "오픈소스 (MIT)", d: "강력한 OCR·문서 이해. 이미지 속 텍스트·차트에 강점. 개방적 라이선스.", col: C.blue },
    { n: "Llama 3.2 Vision", tag: "11B / 90B", type: "오픈 (제한적)", d: "Meta. 거대한 생태계·풍부한 도구. 단, 한국어 OCR 약함 + 라이선스 제약.", col: C.accent },
    { n: "Qwen2.5-VL", tag: "7B / 72B  ⭐", type: "오픈소스 (Apache-2.0)", d: "현존 최강 오픈 OCR + 한국어 + 문서/디자인 이해. 자유로운 라이선스.", col: C.good },
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

  const cols = ["평가 축", "DeepSeek-VL", "Llama Vision", "Qwen2.5-VL", "GPT-5.5"];
  const rows = [
    ["한국어 OCR (30%)", "4", "2", "5", "5"],
    ["미적 판단 (25%)", "3", "3", "4", "5"],
    ["파인튜닝 용이성 (15%)", "4", "4", "5", "2"],
    ["라이선스 (10%)", "5", "3", "5", "1"],
    ["비용 / 호스팅 (10%)", "4", "4", "4", "2"],
    ["생태계 (10%)", "3", "5", "4", "5"],
    ["가중 합산 점수", "3.75", "3.05", "4.55", "3.85"],
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
  s.addText("● 색상: 초록=우수(5) · 주황=양호(4) · 노랑=보통(3) · 빨강=취약(≤2)   |   Qwen2.5-VL이 가중 합산 4.55로 최고", {
    x: 0.9, y: 6.55, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 6 — 파인튜닝 전략 (Fine-tuning)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "05 · Fine-tuning Strategy");
  title(s, "선정 모델을 우리 데이터로 학습시키는 법 — LoRA + 증류");

  const steps = [
    { n: "1. 데이터 생성", icon: "🧑‍🏫", d: "GPT-5.5가 카드를\n평가·라벨링\n→ '지식 증류'", col: C.blue },
    { n: "2. 학습 (LoRA)", icon: "🎓", d: "모델의 ~1%만 학습\nRTX 4090 1장(24GB)\nLLaMA-Factory", col: C.purple },
    { n: "3. 호스팅·서빙", icon: "🚀", d: "Vercel=GPU 없음\n→ API로 호출\nReplicate / Modal", col: C.good },
    { n: "결과", icon: "💰", d: "큰 모델의 행동을\n복제한 작고 저렴한\n전용 모델", col: C.warn },
  ];
  steps.forEach((st, i) => {
    const x = 0.9 + i * 2.95;
    card(s, x, 2.5, 2.7, 2.1, C.panel);
    s.addText(st.icon, { x, y: 2.62, w: 2.7, h: 0.6, fontFace: FONT, fontSize: 30, align: "center" });
    s.addText(st.n, { x, y: 3.25, w: 2.7, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: st.col, align: "center" });
    s.addText(st.d, { x: x + 0.15, y: 3.7, w: 2.4, h: 0.85, fontFace: FONT, fontSize: 11.5, color: C.muted, align: "center", lineSpacing: 15 });
    if (i < 3) s.addText("→", { x: x + 2.55, y: 3.2, w: 0.45, h: 0.6, fontFace: FONT, fontSize: 24, color: C.dim, align: "center" });
  });

  card(s, 0.9, 4.85, 11.55, 1.55, C.bg2);
  s.addText("❓ 정말 파인튜닝이 필요한가?", { x: 1.2, y: 5.0, w: 6, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
  s.addText("이미 RAG(45개 템플릿 few-shot)가 구축됨 → RAG + 프롬프트 개선으로 약 80% 해결 가능. 파인튜닝은 (a) 일관된 평가 루브릭, (b) 비용 절감(큰 모델→작은 모델)이 필요할 때 선택한다.", {
    x: 1.2, y: 5.4, w: 11.0, h: 0.9, fontFace: FONT, fontSize: 13.5, color: C.fg, lineSpacing: 19,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 7 — 결론 / 선정 (Decision)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "06 · Decision");
  title(s, "최종 선정 — Qwen2.5-VL");

  // 선정 배너
  s.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 2.3, w: 11.55, h: 1.3, rectRadius: 0.12, fill: { color: "134E3A" }, line: { color: C.good, width: 1.5 } });
  s.addText("✅ 선정 모델", { x: 1.25, y: 2.5, w: 3, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.good });
  s.addText("Qwen2.5-VL-7B", { x: 1.25, y: 2.85, w: 6, h: 0.6, fontFace: FONT, fontSize: 30, bold: true, color: C.white });
  s.addText("오픈소스 한국어 VLM 중 최고 + 자유로운 Apache 라이선스 + 파인튜닝 용이", {
    x: 6.8, y: 2.5, w: 5.4, h: 1.0, fontFace: FONT, fontSize: 13.5, color: C.fg, valign: "middle", lineSpacing: 19,
  });

  // 근거 3가지
  const reasons = [
    { n: "가장 높은 점수", d: "가중 합산 4.55/5 — 한국어 OCR·디자인 이해에서 DeepSeek·Llama를 모두 능가", col: C.good },
    { n: "통제 + 저비용", d: "셀프호스팅 가능 → 종량 과금 탈피, 데이터 외부 유출 없이 자체 학습", col: C.blue },
    { n: "현실적 하이브리드", d: "취향 판단이 중요한 art_director는 GPT-5.5 유지, 대량 분석·OCR은 Qwen으로 이전", col: C.purple },
  ];
  reasons.forEach((r, i) => {
    const x = 0.9 + i * 3.9;
    card(s, x, 3.85, 3.6, 1.85, C.panel);
    s.addShape(pptx.ShapeType.rect, { x, y: 3.85, w: 0.1, h: 1.85, fill: { color: r.col }, line: { type: "none" } });
    s.addText(r.n, { x: x + 0.3, y: 4.05, w: 3.1, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.fg });
    s.addText(r.d, { x: x + 0.3, y: 4.5, w: 3.1, h: 1.1, fontFace: FONT, fontSize: 12.5, color: C.muted, lineSpacing: 18 });
  });

  // next steps
  s.addText([
    { text: "Next Step  ", options: { color: C.accent, bold: true } },
    { text: "→  45개 레퍼런스 템플릿을 GPT-5.5로 라벨링하여 Qwen2.5-VL 파인튜닝용 학습 데이터셋 구축", options: { color: C.fg } },
  ], { x: 0.9, y: 6.0, w: 11.55, h: 0.5, fontFace: FONT, fontSize: 13.5 });
  footer(s);
})();

// ---- Save ------------------------------------------------------------------
pptx.writeFile({ fileName: "scratch/vlm-model-comparison.pptx" }).then((f) => {
  console.log("✅ 생성 완료:", f);
});
