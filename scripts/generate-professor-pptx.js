/**
 * AI 카드뉴스 생성 시스템 — 교수님 어필용 발표 덱 생성 스크립트
 *
 * 실행: node scripts/generate-professor-pptx.js
 * 출력: scratch/professor-showcase.pptx
 *
 * docs/PROFESSOR_SHOWCASE.md 의 내용을 발표 슬라이드로 옮긴 것.
 * AI 엔지니어링 기여(RAG · agentic self-correction loop · LLM-as-a-judge ·
 * structured IE · parallel fan-out)를 학술 언어로 어필하는 데 초점.
 */

const path = require("path");
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Hyunmin Han";
pptx.company = "carnews-insta";
pptx.subject = "AI 카드뉴스 생성 시스템 — AI 엔지니어링 발표";
pptx.title = "Agentic Card-News Generation";

const W = 13.333;
const H = 7.5;

// ---- Design tokens (포트폴리오 덱과 동일 계열) ------------------------------
const C = {
  bg: "0E0E14",
  bg2: "181822",
  panel: "1C1C28",
  line: "2C2C3C",
  fg: "F5F5F7",
  muted: "9A9AA8",
  dim: "6E6E80",
  accent: "FF7A45",
  accent2: "FFB088",
  purple: "A855F7",
  good: "5AD19A",
  blue: "5AA9FF",
  white: "FFFFFF",
};
const FONT = "Pretendard";
const MONO = "Consolas";

// ---- Helpers ---------------------------------------------------------------
function base(slide) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W * 0.55, h: 0.09, fill: { color: C.accent }, line: { type: "none" } });
  slide.addShape(pptx.ShapeType.rect, { x: W * 0.55, y: 0, w: W * 0.45, h: 0.09, fill: { color: C.purple }, line: { type: "none" } });
}
function kicker(slide, text) {
  slide.addText(text.toUpperCase(), { x: 0.9, y: 0.66, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.accent, charSpacing: 2 });
}
function title(slide, runs, opts = {}) {
  slide.addText(runs, { x: 0.9, y: 1.08, w: 11.5, h: 1.3, fontFace: FONT, fontSize: opts.fontSize || 30, bold: true, color: C.fg, lineSpacing: opts.lineSpacing || 38, align: "left" });
}
let _page = 1;
function footer(slide) {
  _page += 1;
  const page = String(_page).padStart(2, "0");
  slide.addShape(pptx.ShapeType.rect, { x: 0.9, y: 6.92, w: 0.35, h: 0.05, fill: { color: C.accent }, line: { type: "none" } });
  slide.addText("AI 카드뉴스 생성 시스템 · AI 엔지니어링", { x: 0.9, y: 7.0, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim });
  slide.addText(page, { x: 10.4, y: 7.0, w: 2.0, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, align: "right" });
}
function card(slide, x, y, w, h, fill = C.bg2) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: C.line, width: 1 } });
}
function codeBox(slide, x, y, w, h, lines) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: "10131C" }, line: { color: C.line, width: 1 } });
  slide.addText(lines.join("\n"), { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: h - 0.36, fontFace: MONO, fontSize: 12.5, color: C.accent2, lineSpacing: 19, valign: "top", align: "left" });
}
function chips(slide, items, x, y, w, color = C.accent2) {
  let cx = x, cy = y; const chipH = 0.44, pad = 0.22, gap = 0.16;
  items.forEach((it) => {
    const cw = Math.min(0.155 * it.length + pad * 2, w);
    if (cx + cw > x + w) { cx = x; cy += chipH + gap; }
    slide.addShape(pptx.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: chipH, rectRadius: 0.22, fill: { color: C.bg2 }, line: { color: C.line, width: 1 } });
    slide.addText(it, { x: cx, y: cy, w: cw, h: chipH, fontFace: FONT, fontSize: 11.5, color, align: "center", valign: "middle" });
    cx += cw + gap;
  });
}

// ===========================================================================
// SLIDE 1 — Cover
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 8.7, y: 0, w: W - 8.7, h: H, fill: { color: "5B2A9E" }, line: { type: "none" } });
  s.addShape(pptx.ShapeType.rect, { x: 8.7, y: 0, w: W - 8.7, h: H * 0.4, fill: { color: C.accent }, line: { type: "none" } });
  // 우측 패널: 에이전트 루프 미니 다이어그램
  const nodes = ["planner", "retriever (RAG)", "copywriter", "designer", "image_gen", "art_director ▶ 채점", "reviser ↺ loop"];
  nodes.forEach((n, i) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 9.05, y: 1.05 + i * 0.78, w: 3.9, h: 0.6, rectRadius: 0.1, fill: { color: C.white, transparency: 14 }, line: { type: "none" } });
    s.addText(n, { x: 9.05, y: 1.05 + i * 0.78, w: 3.9, h: 0.6, fontFace: MONO, fontSize: 12, bold: i >= 5, color: C.white, align: "center", valign: "middle" });
  });

  s.addText("AI ENGINEERING · AGENTIC SYSTEM", { x: 0.9, y: 1.3, w: 7.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent, charSpacing: 2 });
  s.addText([
    { text: "프롬프트 호출이 아니라\n", options: { color: C.fg } },
    { text: "에이전트 시스템", options: { color: C.accent } },
  ], { x: 0.9, y: 1.95, w: 7.6, h: 2.0, fontFace: FONT, fontSize: 38, bold: true, lineSpacing: 46 });
  s.addText("검색(RAG)으로 근거를 대고 · 비전 모델이 결과를 채점해 스스로 고치는 · LangGraph 상태 그래프 기반 멀티에이전트 카드뉴스 생성 시스템", {
    x: 0.9, y: 4.0, w: 7.5, h: 1.2, fontFace: FONT, fontSize: 15, color: C.muted, lineSpacing: 24 });
  chips(s, ["LangGraph", "RAG · pgvector", "LLM-as-a-judge", "Structured IE", "FastAPI · Next.js 16"], 0.9, 5.4, 7.5);
  s.addText("Hyunmin Han · 2026", { x: 0.9, y: 6.6, w: 6, h: 0.3, fontFace: FONT, fontSize: 12, color: C.muted });
})();

// ===========================================================================
// SLIDE 2 — 핵심 기여 5가지
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Key Contributions · 핵심 기여");
  title(s, [{ text: "단일 LLM 호출이면 불가능한 ", options: { color: C.fg } }, { text: "5가지 구조", options: { color: C.accent } }]);

  const rows = [
    ["①", "사이클(피드백 루프)을 가진 상태 그래프", "Agentic workflow / cyclic graph", "graph.py"],
    ["②", "실제 사람이 만든 45개 디자인을 벡터 검색해 근거로 사용", "RAG (retrieval-grounded)", "rag/store.py"],
    ["③", "비전 모델이 결과를 루브릭으로 채점 → 미달이면 재생성", "LLM-as-a-judge / self-refine", "art_director.py"],
    ["④", "자유형 텍스트 → JSON Schema strict 정보추출(IE)", "Structured generation / IE", "lib/extract.ts"],
    ["⑤", "N장 슬라이드를 병렬 fan-out으로 동시 생성", "Map-reduce / parallel dispatch", "graph.py: Send"],
  ];
  rows.forEach((r, i) => {
    const y = 2.55 + i * 0.84;
    card(s, 0.9, y, 11.5, 0.74);
    s.addText(r[0], { x: 1.05, y, w: 0.6, h: 0.74, fontFace: FONT, fontSize: 22, bold: true, color: C.accent, valign: "middle", align: "center" });
    s.addText(r[1], { x: 1.75, y, w: 6.3, h: 0.74, fontFace: FONT, fontSize: 14.5, bold: true, color: C.fg, valign: "middle", lineSpacing: 17 });
    s.addText(r[2], { x: 8.15, y, w: 3.0, h: 0.74, fontFace: FONT, fontSize: 11.5, color: C.purple, valign: "middle" });
    s.addText(r[3], { x: 11.15, y, w: 1.2, h: 0.74, fontFace: MONO, fontSize: 9.5, color: C.dim, valign: "middle", align: "right" });
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 3 — 시스템 아키텍처 (2 서비스)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Architecture · 책임 분리");
  title(s, [{ text: "두 개의 서비스, ", options: { color: C.fg } }, { text: "각자 한 가지 책임", options: { color: C.accent } }]);

  card(s, 0.9, 2.7, 5.4, 2.4);
  s.addText("Next.js 16 앱", { x: 1.2, y: 2.95, w: 4.8, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.accent2 });
  s.addText("UI · Auth · Prisma · DB\nFabric.js 캔버스 렌더\n(표현 · 영속)", { x: 1.2, y: 3.45, w: 4.8, h: 1.4, fontFace: FONT, fontSize: 14, color: C.fg, lineSpacing: 24 });

  card(s, 7.0, 2.7, 5.4, 2.4);
  s.addText("agent-service (Python)", { x: 7.3, y: 2.95, w: 4.8, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.purple });
  s.addText("FastAPI + LangGraph\n오케스트레이션 \"두뇌\"\n(AI 의사결정 · 루프)", { x: 7.3, y: 3.45, w: 4.8, h: 1.4, fontFace: FONT, fontSize: 14, color: C.fg, lineSpacing: 24 });

  s.addShape(pptx.ShapeType.line, { x: 6.3, y: 3.6, w: 0.7, h: 0, line: { color: C.accent, width: 2, endArrowType: "triangle", beginArrowType: "triangle" } });
  s.addText("SSE / HTTP\nnode-by-node 이벤트", { x: 5.9, y: 3.7, w: 1.5, h: 0.6, fontFace: FONT, fontSize: 9, color: C.muted, align: "center" });

  card(s, 0.9, 5.4, 11.5, 1.1, "12121A");
  s.addText("공유 인프라", { x: 1.2, y: 5.55, w: 3, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.dim });
  s.addText("Postgres (Neon)  ·  pgvector 인덱스(RAG)  ·  GPT-5.5 / gpt-image-2  ·  Vercel · Railway · Docker", {
    x: 1.2, y: 5.9, w: 11, h: 0.4, fontFace: FONT, fontSize: 13, color: C.fg });
  s.addText("→ AI 로직을 UI에서 분리: 독립 배포 · 독립 스케일 · 독립 테스트", { x: 0.9, y: 2.35, w: 11.5, h: 0.3, fontFace: FONT, fontSize: 12, italic: true, color: C.muted });
  footer(s);
})();

// ===========================================================================
// SLIDE 4 — 에이전트 그래프 (the cycle)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "LangGraph StateGraph · 핵심");
  title(s, [{ text: "사이클이 있는 ", options: { color: C.fg } }, { text: "자기수정 루프", options: { color: C.accent } }]);

  codeBox(s, 0.9, 2.6, 11.5, 2.1, [
    "planner → retriever → copywriter ─┬─▶ render_slide ─┐",
    "                                  ├─▶ render_slide ─┼─▶ collect → END",
    "                                  └─▶ render_slide ─┘   (슬라이드마다 1 브랜치, 병렬)",
    "",
    "  render_slide 내부:  designer → image_gen → art_director(비전 채점)",
    "                                    ▲                       │",
    "                                    └──── reviser ◀─────────┘  (score<th 이면 loop)",
  ]);
  const steps = [
    "planner — 주제를 슬라이드 역할로 분해",
    "retriever — 45개 템플릿 top-k 코사인 검색",
    "copywriter — 검색 톤에 맞춰 카피 작성",
    "art_director — 루브릭 0~10 채점 + 수정안",
    "reviser — 수정안을 지시문으로 designer 루프백",
    "종료 — 점수 ≥ 임계값 OR 최대 반복수",
  ];
  steps.forEach((t, i) => {
    const x = 0.9 + (i % 2) * 5.85; const y = 5.0 + Math.floor(i / 2) * 0.6;
    s.addText("•", { x, y, w: 0.3, h: 0.5, fontFace: FONT, fontSize: 14, color: C.accent, valign: "middle" });
    s.addText(t, { x: x + 0.3, y, w: 5.4, h: 0.5, fontFace: FONT, fontSize: 12.5, color: C.fg, valign: "middle" });
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 5 — 왜 프롬프트 체인이 아닌가
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Why not a prompt chain · 반론 차단");
  title(s, [{ text: "\"그냥 ChatGPT 호출 아니냐\"에 대한 ", options: { color: C.fg } }, { text: "3가지 답", options: { color: C.accent } }]);

  const cols = [
    ["사이클이 있다", "art_director → reviser → designer 는 피드백 루프. 일반 파이프라인이 표현 못 하는 구조. LangGraph가 상태+조건부 엣지+반복상한으로 1급 처리.", "상태기계로서의 에이전트", C.accent],
    ["검색으로 근거를 댄다", "기존 /api/match는 템플릿 '이름'만 줬다(환각). 새 retriever는 실제 디자인 내용을 임베딩 → 코사인 랭킹. 모델 prior가 아닌 사람 레퍼런스에 grounding.", "진짜 RAG", C.purple],
    ["스스로 평가한다", "비전 critic이 고정 루브릭(가독성/위계/여백/아티팩트/한글)으로 점수를 매겨 루프를 닫는다. 품질이 '가정'이 아니라 '측정'.", "eval-in-the-loop", C.good],
  ];
  cols.forEach((c, i) => {
    const x = 0.9 + i * 3.92;
    card(s, x, 2.7, 3.66, 3.7);
    s.addShape(pptx.ShapeType.rect, { x: x, y: 2.7, w: 0.1, h: 3.7, fill: { color: c[3] }, line: { type: "none" } });
    s.addText(`${i + 1}`, { x: x + 0.3, y: 2.9, w: 1, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: c[3] });
    s.addText(c[0], { x: x + 0.3, y: 3.5, w: 3.1, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: C.fg });
    s.addText(c[1], { x: x + 0.3, y: 4.05, w: 3.15, h: 1.8, fontFace: FONT, fontSize: 12, color: C.muted, lineSpacing: 18, valign: "top" });
    s.addText(c[2], { x: x + 0.3, y: 5.95, w: 3.15, h: 0.35, fontFace: MONO, fontSize: 11, bold: true, color: c[3] });
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 6 — RAG 3단 graceful degradation
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Engineering Maturity · RAG");
  title(s, [{ text: "키 하나 없어도 도는 ", options: { color: C.fg } }, { text: "3단 우아한 성능저하", options: { color: C.accent } }]);

  const tiers = [
    ["1순위", "pgvector + DATABASE_URL", "DB에 임베딩 영속/질의 (운영 경로 · dense retrieval)", C.good],
    ["2순위", "in-process numpy 인덱스", "startup 시 구축. DB 없어도 임베딩 검색 동작.", C.blue],
    ["3순위", "어휘 폴백 (토큰 + 한글 bigram)", "OpenAI 키조차 없을 때. '흑돼지'↔'돼지'가 bigram 공유 → 신호 확보.", C.accent2],
  ];
  tiers.forEach((t, i) => {
    const y = 2.7 + i * 1.05;
    card(s, 0.9, y, 11.5, 0.92);
    s.addText(t[0], { x: 1.1, y, w: 1.2, h: 0.92, fontFace: FONT, fontSize: 15, bold: true, color: t[3], valign: "middle", align: "center" });
    s.addText(t[1], { x: 2.4, y, w: 4.0, h: 0.92, fontFace: MONO, fontSize: 13.5, bold: true, color: C.fg, valign: "middle" });
    s.addText(t[2], { x: 6.5, y, w: 5.7, h: 0.92, fontFace: FONT, fontSize: 12.5, color: C.muted, valign: "middle", lineSpacing: 17 });
  });
  s.addText("⇒ 외부 호출 0으로 그래프가 end-to-end로 돈다 = CI · 오프라인 데모 · 테스트 가능 (agent-service/tests/)", {
    x: 0.9, y: 6.0, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 13, italic: true, color: C.good });
  footer(s);
})();

// ===========================================================================
// SLIDE 7 — LLM-as-a-judge + 한글 타이포 구조적 해결
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Self-correction · 품질의 내재화");
  title(s, [{ text: "비전 critic이 ", options: { color: C.fg } }, { text: "점수로 루프를 닫는다", options: { color: C.accent } }]);

  card(s, 0.9, 2.7, 5.6, 3.6);
  s.addText("루브릭 채점 (JSON 강제 출력)", { x: 1.2, y: 2.9, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.accent2 });
  s.addText([
    { text: "0~10점 채점 기준\n", options: { bold: true, color: C.fg } },
    { text: "• 구도 / 시각적 위계\n• 색·무드의 매력\n• 하단 텍스트 오버레이용 여백\n• 잡티·아티팩트 유무\n• 이미지에 글자 보이면 큰 감점\n", options: { color: C.muted } },
    { text: '\nout: {score, issues[], fixes[], has_text}', options: { color: C.purple, fontFace: MONO } },
  ], { x: 1.2, y: 3.4, w: 5.0, h: 2.7, fontFace: FONT, fontSize: 13, lineSpacing: 22, valign: "top" });

  card(s, 6.8, 2.7, 5.6, 3.6);
  s.addText("한글 타이포: 구조적 해결", { x: 7.1, y: 2.9, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.purple });
  s.addText([
    { text: "문제: ", options: { bold: true, color: C.accent } },
    { text: "확산모델이 한글을 픽셀로 구우면 헛글자 발생\n\n", options: { color: C.muted } },
    { text: "해결: ", options: { bold: true, color: C.good } },
    { text: "배경엔 글자 0개로 강제 + 한국어 카피는 브라우저에서 진짜 텍스트 객체로 오버레이\n\n", options: { color: C.fg } },
    { text: "→ 편집 가능 + 한글 자형 정상. critic 루브릭이 '글자 보이면 감점'으로 불변식을 강제.", options: { color: C.muted } },
  ], { x: 7.1, y: 3.4, w: 5.0, h: 2.7, fontFace: FONT, fontSize: 13, lineSpacing: 21, valign: "top" });

  s.addText("핵심: 품질을 '잘 나오겠지'가 아니라 루브릭으로 정량 채점하고, 그 점수를 종료조건으로 쓴다.", {
    x: 0.9, y: 2.35, w: 11.5, h: 0.3, fontFace: FONT, fontSize: 12, italic: true, color: C.muted });
  footer(s);
})();

// ===========================================================================
// SLIDE 8 — 정보추출(IE) 파이프라인
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Information Extraction · 별도 어필");
  title(s, [{ text: "자유형 텍스트 → ", options: { color: C.fg } }, { text: "결정적 구조 데이터", options: { color: C.accent } }]);

  const stages = [["load", "URL이면 cheerio로\n본문/메타 추출"], ["clean", "보일러플레이트 제거\n토큰 절약"], ["extract", "JSON Schema strict\n강제 추출"], ["verify", "스키마 후처리\n슬라이드 수 정합성"]];
  stages.forEach((st, i) => {
    const x = 0.9 + i * 2.95;
    card(s, x, 2.7, 2.7, 1.4);
    s.addText(st[0], { x, y: 2.85, w: 2.7, h: 0.45, fontFace: MONO, fontSize: 15, bold: true, color: C.accent, align: "center" });
    s.addText(st[1], { x: x + 0.15, y: 3.3, w: 2.4, h: 0.75, fontFace: FONT, fontSize: 11.5, color: C.muted, align: "center", lineSpacing: 16 });
    if (i < 3) s.addText("▶", { x: x + 2.62, y: 2.7, w: 0.4, h: 1.4, fontFace: FONT, fontSize: 14, color: C.dim, align: "center", valign: "middle" });
  });
  codeBox(s, 0.9, 4.45, 11.5, 1.85, [
    "// CardBrief — JSON Schema(strict)로 모델이 형식을 어길 수 없게 강제",
    "headline · summary · key_points[3..6] · entities[{name, type}]",
    "tone: enum(informative|promotional|casual|urgent|educational)",
    "slides[3..6]: {role: cover|point|cta, title, body}",
    "→ NER + 분류 + 요약 + 구조화 분할을 한 번의 extraction으로",
  ]);
  footer(s);
})();

// ===========================================================================
// SLIDE 9 — 한계 & 로드맵 + Q&A 방어
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Limitations & Next · 정직성");
  title(s, [{ text: "한계를 먼저 말한다 ", options: { color: C.fg } }, { text: "(그게 신뢰를 만든다)", options: { color: C.accent } }]);

  card(s, 0.9, 2.7, 5.6, 3.5);
  s.addText("현재 한계", { x: 1.2, y: 2.9, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.accent });
  s.addText([
    { text: "• critic 점수의 오프라인 검증(골든셋) 미비\n", options: {} },
    { text: "• RAG 코퍼스가 45개로 작음 (확장 필요)\n", options: {} },
    { text: "• 비용/지연 줄일 모델 라우팅 미적용\n", options: {} },
    { text: "  (쉬운 카드는 저렴 모델로)", options: { color: C.dim } },
  ], { x: 1.2, y: 3.45, w: 5.1, h: 2.6, fontFace: FONT, fontSize: 13.5, color: C.fg, lineSpacing: 26, valign: "top" });

  card(s, 6.8, 2.7, 5.6, 3.5);
  s.addText("로드맵 (증명 계획)", { x: 7.1, y: 2.9, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.good });
  s.addText([
    { text: "• 골든셋 eval: 사람 점수 vs critic 상관\n", options: {} },
    { text: "• OCR → IE 엔드투엔드 라우트\n", options: {} },
    { text: "• HF 한국어 tone 분류기 파인튜닝\n", options: {} },
    { text: "• FastAPI+Docker 클라우드 서빙 + CI/CD\n", options: {} },
    { text: "  docs/AI_ENGINEER_GAP_ROADMAP.md", options: { color: C.dim, fontFace: MONO } },
  ], { x: 7.1, y: 3.45, w: 5.1, h: 2.6, fontFace: FONT, fontSize: 13.5, color: C.fg, lineSpacing: 26, valign: "top" });
  footer(s);
})();

// ===========================================================================
// SLIDE 10 — Closing / 90초 스크립트 요약
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "In one breath · 한 문장 요약");
  title(s, [{ text: "검색으로 근거 대고 · 채점으로 ", options: { color: C.fg } }, { text: "스스로 고치는", options: { color: C.accent } }, { text: " 에이전트", options: { color: C.fg } }], { fontSize: 26, lineSpacing: 34 });

  card(s, 0.9, 2.6, 11.5, 2.6, "14141E");
  s.addText([
    { text: "\"카드뉴스 생성을 단일 AI 호출이 아니라 에이전트 시스템으로 재설계했습니다. ", options: { color: C.fg } },
    { text: "사람이 만든 45개 디자인을 벡터 검색(RAG)", options: { color: C.accent, bold: true } },
    { text: "해 근거로 대고, 결과를 ", options: { color: C.fg } },
    { text: "비전 모델이 루브릭으로 채점해 미달이면 다시 만드는 자기수정 루프", options: { color: C.purple, bold: true } },
    { text: "를 LangGraph로 구현했습니다. 한글이 깨지는 확산모델 한계는 ", options: { color: C.fg } },
    { text: "'배경엔 글자 0개, 텍스트는 진짜 객체로 오버레이'라는 구조", options: { color: C.good, bold: true } },
    { text: "로 제거했습니다. 한계도 분명합니다 — critic 점수의 오프라인 검증과 RAG 코퍼스 확장이 다음 과제입니다.\"", options: { color: C.fg } },
  ], { x: 1.3, y: 2.9, w: 10.7, h: 2.0, fontFace: FONT, fontSize: 15, lineSpacing: 26, valign: "top" });

  chips(s, ["LangGraph 상태 그래프", "RAG · pgvector", "LLM-as-a-judge", "Structured IE", "병렬 fan-out", "graceful degradation"], 0.9, 5.5, 11.5);
  s.addText("감사합니다 · Q&A", { x: 0.9, y: 6.55, w: 6, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.accent });
  footer(s);
})();

// ---- write -----------------------------------------------------------------
const outPath = path.join(__dirname, "..", "scratch", "professor-showcase.pptx");
pptx.writeFile({ fileName: outPath }).then((f) => {
  console.log("✅ 생성 완료:", f);
});
