/**
 * AI 카드뉴스 자동화 SaaS — 포트폴리오 PPT 생성 스크립트
 *
 * 실행: node scripts/generate-portfolio-pptx.js
 * 출력: scratch/carnews-automation-portfolio.pptx
 *
 * "내가 만든 자동화 프로젝트" 관점의 포트폴리오 덱.
 * 제안서(references/docs/.../카드뉴스 자동화 소개서.pdf)의 문제·시장·솔루션 서사에
 * 실제 구현 기술스택 · 엔지니어링 도전 · 개발 과정 · 성과를 결합했다.
 */

const path = require("path");
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Hyunmin Han";
pptx.company = "carnews-insta";
pptx.subject = "AI 카드뉴스 자동화 SaaS — 포트폴리오";
pptx.title = "AI 카드뉴스 자동화 SaaS";

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
  white: "FFFFFF",
};
const FONT = "Pretendard"; // 미설치 시 뷰어가 기본 한글 폰트로 대체 렌더
const FONT_MONO = "Consolas";

// ---- Helpers ---------------------------------------------------------------
function base(slide) {
  slide.background = { color: C.bg };
  // 좌상단 은은한 보라 글로우 (사각형 페이드 대용)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { type: "solid", color: C.bg },
    line: { type: "none" },
  });
  // 상단 그라데이션 액센트 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W * 0.55, h: 0.09,
    fill: { color: C.accent }, line: { type: "none" },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: W * 0.55, y: 0, w: W * 0.45, h: 0.09,
    fill: { color: C.purple }, line: { type: "none" },
  });
}

function kicker(slide, text) {
  slide.addText(text.toUpperCase(), {
    x: 0.9, y: 0.72, w: 11.5, h: 0.4,
    fontFace: FONT, fontSize: 13, bold: true,
    color: C.accent, charSpacing: 2,
  });
}

function title(slide, runs, opts = {}) {
  slide.addText(runs, {
    x: 0.9, y: 1.15, w: 11.5, h: 1.5,
    fontFace: FONT, fontSize: opts.fontSize || 33, bold: true,
    color: C.fg, lineSpacing: opts.lineSpacing || 40, align: "left",
  });
}

let _page = 1; // 표지=1, footer 호출 시마다 증가
function footer(slide) {
  _page += 1;
  const page = String(_page).padStart(2, "0");
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.9, y: 6.92, w: 0.35, h: 0.05,
    fill: { color: C.accent }, line: { type: "none" },
  });
  slide.addText("AI 카드뉴스 자동화 SaaS · 포트폴리오", {
    x: 0.9, y: 7.0, w: 8, h: 0.3,
    fontFace: FONT, fontSize: 9, color: C.dim, align: "left",
  });
  slide.addText(page, {
    x: 10.4, y: 7.0, w: 2.0, h: 0.3,
    fontFace: FONT, fontSize: 9, color: C.dim, align: "right",
  });
}

// 둥근 카드
function card(slide, x, y, w, h, fill = C.bg2) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: fill }, line: { color: C.line, width: 1 },
  });
}

// 칩
function chips(slide, items, x, y, w) {
  let cx = x;
  let cy = y;
  const chipH = 0.46;
  const pad = 0.22;
  const gap = 0.18;
  items.forEach((it) => {
    const cw = Math.min(0.16 * it.length + pad * 2, w);
    if (cx + cw > x + w) { cx = x; cy += chipH + gap; }
    slide.addShape(pptx.ShapeType.roundRect, {
      x: cx, y: cy, w: cw, h: chipH, rectRadius: 0.23,
      fill: { color: C.bg2 }, line: { color: C.line, width: 1 },
    });
    slide.addText(it, {
      x: cx, y: cy, w: cw, h: chipH,
      fontFace: FONT, fontSize: 12, color: C.accent2, align: "center", valign: "middle",
    });
    cx += cw + gap;
  });
}

// ===========================================================================
// SLIDE 1 — Cover
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  // 큰 우측 그라데이션 패널
  s.addShape(pptx.ShapeType.rect, {
    x: 8.6, y: 0, w: W - 8.6, h: H,
    fill: { color: "7C3AED" },
    line: { type: "none" },
  });
  // 오렌지 → 퍼플 느낌의 상단 블록
  s.addShape(pptx.ShapeType.rect, {
    x: 8.6, y: 0, w: W - 8.6, h: H * 0.42,
    fill: { color: C.accent }, line: { type: "none" },
  });
  // 패널 위 어둡게 오버레이로 텍스트 가독성 (반투명 대용 — 카드뉴스 미리보기 자리)
  for (let i = 0; i < 4; i++) {
    s.addShape(pptx.ShapeType.roundRect, {
      x: 9.15 + (i % 2) * 1.75, y: 1.6 + Math.floor(i / 2) * 2.2,
      w: 1.5, h: 1.95, rectRadius: 0.1,
      fill: { color: C.white, transparency: 12 }, line: { type: "none" },
    });
  }

  s.addText("PORTFOLIO · AI AUTOMATION SaaS", {
    x: 0.9, y: 1.35, w: 7.5, h: 0.4,
    fontFace: FONT, fontSize: 14, bold: true, color: C.accent, charSpacing: 2,
  });
  s.addText(
    [
      { text: "콘텐츠는 빠르게,\n", options: { color: C.fg } },
      { text: "카드뉴스는 자동으로", options: { color: C.accent } },
    ],
    {
      x: 0.9, y: 2.0, w: 7.5, h: 2.0,
      fontFace: FONT, fontSize: 40, bold: true, lineSpacing: 48, align: "left",
    }
  );
  s.addText("텍스트만 넣으면 완성되는 카드뉴스 — 1시간의 수작업을 5분으로 압축한 AI 콘텐츠 자동화 SaaS", {
    x: 0.9, y: 4.05, w: 7.4, h: 1.0,
    fontFace: FONT, fontSize: 16, color: C.muted, lineSpacing: 26,
  });

  chips(s, ["Next.js 16", "React 19", "OpenAI GPT-4o", "Fabric.js", "Prisma · Neon"], 0.9, 5.2, 7.3);

  s.addText("Hyunmin Han · 1인 풀스택 기획·개발·배포", {
    x: 0.9, y: 6.55, w: 6, h: 0.3, fontFace: FONT, fontSize: 12, color: C.muted,
  });
  s.addText("2026", {
    x: 7.0, y: 6.55, w: 1.3, h: 0.3, fontFace: FONT, fontSize: 12, color: C.dim, align: "right",
  });
})();

// ===========================================================================
// SLIDE 2 — 프로젝트 개요
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Project Overview · 한 줄 요약");
  title(s, [
    { text: "AI가 기획·요약·디자인까지 대신하는\n", options: { color: C.fg } },
    { text: "1인 창작자용 카드뉴스 자동화 SaaS", options: { color: C.accent } },
  ]);

  const meta = [
    { k: "역할", v: "기획 · 풀스택 개발 · 배포\n(1인 프로젝트)" },
    { k: "핵심 가치", v: "텍스트 입력 → 카드뉴스 5장\n자동 생성" },
    { k: "성과 검증", v: "Threads 조회수 13만 +\n실고객 심층 인터뷰" },
  ];
  meta.forEach((m, i) => {
    const x = 0.9 + i * 3.95;
    card(s, x, 3.2, 3.7, 2.0);
    s.addText(m.k, {
      x: x + 0.35, y: 3.5, w: 3.0, h: 0.4,
      fontFace: FONT, fontSize: 13, bold: true, color: C.accent2,
    });
    s.addText(m.v, {
      x: x + 0.35, y: 3.95, w: 3.05, h: 1.0,
      fontFace: FONT, fontSize: 17, bold: true, color: C.fg, lineSpacing: 24,
    });
  });

  s.addText(
    "“제가 직접 콘텐츠를 운영하며 겪고, 고객 인터뷰로 검증한 실제 문제에서 출발한 제품입니다.”",
    { x: 0.9, y: 5.55, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 14, italic: true, color: C.muted }
  );
  footer(s);
})();

// ===========================================================================
// SLIDE — AI 엔지니어링 역량 맵 (JD 요건 → 실제 구현 근거)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "AI Engineering · 채용 요건 매칭");
  title(s, [
    { text: "“기획한” 서비스가 아니라, ", options: { color: C.fg } },
    { text: "직접 설계·구현·배포", options: { color: C.accent } },
    { text: "한\nAI 시스템", options: { color: C.fg } },
  ]);

  const rows = [
    ["OpenAI API 기반 AI 시스템", "GPT-4o Vision 분석 · 매칭 · 정보추출 파이프라인", "api/analyze · match · extract"],
    ["LLM 기반 NLP / 정보추출(IE)", "structured outputs(JSON Schema)로 기사→카드 브리프 추출", "lib/extract.ts"],
    ["클라우드 배포 · 운영", "Vercel · Railway · Neon(Postgres) 환경변수·DB 연동", "production"],
    ["컨테이너 · 인프라", "멀티스테이지 Docker 빌드 · 배포 자동화", "Dockerfile"],
  ];
  rows.forEach((r, i) => {
    const y = 3.0 + i * 0.82;
    card(s, 0.9, y, 11.5, 0.7, C.bg2);
    // 체크 배지
    s.addShape(pptx.ShapeType.roundRect, {
      x: 1.1, y: y + 0.19, w: 0.34, h: 0.34, rectRadius: 0.17,
      fill: { color: C.good }, line: { type: "none" },
    });
    s.addText("✓", {
      x: 1.1, y: y + 0.19, w: 0.34, h: 0.34, fontFace: FONT, fontSize: 13, bold: true,
      color: "0E0E14", align: "center", valign: "middle",
    });
    s.addText(r[0], {
      x: 1.6, y, w: 3.5, h: 0.7, fontFace: FONT, fontSize: 13, bold: true, color: C.fg, valign: "middle",
    });
    s.addText(r[1], {
      x: 5.2, y, w: 5.2, h: 0.7, fontFace: FONT, fontSize: 11.5, color: C.muted, valign: "middle",
    });
    s.addText(r[2], {
      x: 10.5, y, w: 1.85, h: 0.7, fontFace: FONT_MONO, fontSize: 9.5, color: C.accent2, valign: "middle", align: "right",
    });
  });

  s.addText("JD의 OpenAI API · IE · 클라우드 배포 · Docker 요건을 실제 코드/배포로 증명 — 학습·서빙(PyTorch·서버리스)은 진행 중 로드맵.", {
    x: 0.9, y: 6.35, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 11.5, italic: true, color: C.dim,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 3 — 문제 정의
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Problem · 제작 병목");
  title(s, [
    { text: "콘텐츠 아이디어는 풍부하지만,\n", options: { color: C.fg } },
    { text: "제작 과정 자체가 거대한 병목", options: { color: C.accent } },
  ]);

  const steps = [
    "1. 기획 및 주제 선정",
    "2. 핵심 문구 요약 · 다듬기",
    "3. 장표별 텍스트 분할",
    "4. 디자인 템플릿 맞춤 작업",
  ];
  steps.forEach((t, i) => {
    const y = 3.1 + i * 0.62;
    card(s, 0.9, y, 6.0, 0.5, C.bg2);
    s.addText(t, {
      x: 1.2, y, w: 5.6, h: 0.5, fontFace: FONT, fontSize: 14, color: C.fg, valign: "middle",
    });
  });

  // 우측 강조 패널
  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.4, y: 3.0, w: 5.0, h: 2.95, rectRadius: 0.14,
    fill: { color: C.panel }, line: { color: C.accent, width: 1.5 },
  });
  s.addText("디자이너가 없는 1인 창작자에게,", {
    x: 7.8, y: 3.4, w: 4.3, h: 0.6, fontFace: FONT, fontSize: 18, color: C.muted,
  });
  s.addText("이 반복 작업은 콘텐츠 생산을\n가로막는 가장 큰 장벽", {
    x: 7.8, y: 3.95, w: 4.3, h: 1.3, fontFace: FONT, fontSize: 22, bold: true, color: C.fg, lineSpacing: 30,
  });
  s.addText("꾸준한 업로드가 필수지만, 매번 1시간 가까이 소요", {
    x: 7.8, y: 5.3, w: 4.3, h: 0.5, fontFace: FONT, fontSize: 13, color: C.accent2,
  });

  s.addText("콘텐츠 아이디어(풍부함)  →  4단계 수작업(병목)  →  최종 업로드(느림)", {
    x: 0.9, y: 6.05, w: 6.0, h: 0.5, fontFace: FONT, fontSize: 12, color: C.dim, italic: true,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 4 — 타깃 & 시장
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Target · 시장 정의");
  title(s, [
    { text: "고빈도 콘텐츠가 필요하지만\n", options: { color: C.fg } },
    { text: "디자인 리소스가 없는 실무자", options: { color: C.accent } },
  ]);

  // 2x2 매트릭스
  const mx = 0.9, my = 3.0, mw = 5.6, mh = 3.1;
  // 축 라벨
  s.addText("콘텐츠 업로드 빈도 →", {
    x: mx - 0.1, y: my - 0.3, w: 4, h: 0.3, fontFace: FONT, fontSize: 10, color: C.dim,
  });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const x = mx + c * (mw / 2 + 0.1);
      const y = my + r * (mh / 2 + 0.1);
      const highlight = r === 0 && c === 1; // 우상단
      s.addShape(pptx.ShapeType.roundRect, {
        x, y, w: mw / 2 - 0.05, h: mh / 2 - 0.05, rectRadius: 0.1,
        fill: highlight ? { color: C.accent } : { color: C.bg2 },
        line: { color: C.line, width: 1 },
      });
    }
  }
  s.addText("핵심 타깃", {
    x: mx + mw / 2 + 0.05, y: my + 0.1, w: mw / 2 - 0.2, h: 0.4,
    fontFace: FONT, fontSize: 12, bold: true, color: C.white,
  });
  s.addText("강사·교육 크리에이터 / 소상공인 SNS 운영자\n1인 브랜드 / 1인 마케터", {
    x: mx + mw / 2 + 0.05, y: my + 0.5, w: mw / 2 - 0.2, h: 1.0,
    fontFace: FONT, fontSize: 13, bold: true, color: C.white, lineSpacing: 20,
  });
  s.addText("사내 디자인 리소스 없음 →", {
    x: mx, y: my + mh + 0.05, w: 4, h: 0.3, fontFace: FONT, fontSize: 10, color: C.dim,
  });

  // 우측 설명
  s.addText("초기 타깃 명확화", {
    x: 7.0, y: 3.2, w: 5.4, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.accent,
  });
  const bullets = [
    "매주 / 매일 카드뉴스를 만들어야 하는 실무자",
    "디자인 감각·인력은 부족하지만 브랜드 일관성은 필요",
    "외주·도구 전환 비용이 부담되는 1인 운영 단위",
  ];
  s.addText(bullets.map((b) => ({ text: b, options: { bullet: { code: "25B8", indent: 18 }, color: C.fg } })), {
    x: 7.0, y: 3.85, w: 5.4, h: 2.0, fontFace: FONT, fontSize: 14.5, color: C.fg,
    lineSpacingMultiple: 1.5, paraSpaceAfter: 10,
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 5 — 솔루션 (Before / After)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Solution · Before / After");
  title(s, [
    { text: "1시간의 수작업을 ", options: { color: C.fg } },
    { text: "5분의 자동화", options: { color: C.accent } },
    { text: "로 압축", options: { color: C.fg } },
  ]);

  // Before
  card(s, 0.9, 2.95, 5.5, 3.4, C.bg2);
  s.addText("기존 수작업 방식", {
    x: 0.9, y: 3.15, w: 5.5, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: C.muted, align: "center",
  });
  const before = [
    ["기획 / 작성", "워드 프로세서 사용 · 20분"],
    ["디자인 / 배치", "텍스트 수동 복사·붙여넣기 · 30분"],
    ["의존도", "디자인 감각 혹은 디자이너 필수"],
  ];
  before.forEach((b, i) => {
    const y = 3.7 + i * 0.62;
    s.addText([
      { text: b[0] + "  ", options: { bold: true, color: C.fg } },
      { text: b[1], options: { color: C.muted } },
    ], { x: 1.2, y, w: 5.0, h: 0.55, fontFace: FONT, fontSize: 12.5, valign: "middle" });
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 1.2, y: 5.65, w: 4.9, h: 0.5, rectRadius: 0.1, fill: { color: "33333F" }, line: { type: "none" },
  });
  s.addText("총 소요 시간: 약 1시간", {
    x: 1.2, y: 5.65, w: 4.9, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: C.fg, align: "center", valign: "middle",
  });

  // After
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.95, y: 2.95, w: 5.45, h: 3.4, rectRadius: 0.14,
    fill: { color: C.panel }, line: { color: C.accent, width: 1.5 },
  });
  s.addText("AI SaaS 워크플로우", {
    x: 6.95, y: 3.15, w: 5.45, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: C.accent, align: "center",
  });
  const after = [
    ["기획 / 작성", "텍스트 입력창 하나로 통합 · 3분"],
    ["디자인 / 배치", "AI 슬라이드 분할·템플릿 자동 매핑 · 2분"],
    ["의존도", "누구나 혼자서 즉시 완성"],
  ];
  after.forEach((b, i) => {
    const y = 3.7 + i * 0.62;
    s.addText([
      { text: b[0] + "  ", options: { bold: true, color: C.fg } },
      { text: b[1], options: { color: C.accent2 } },
    ], { x: 7.25, y, w: 4.9, h: 0.55, fontFace: FONT, fontSize: 12.5, valign: "middle" });
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.25, y: 5.65, w: 4.85, h: 0.5, rectRadius: 0.1,
    fill: { color: C.accent }, line: { type: "none" },
  });
  s.addText("총 소요 시간: 5분", {
    x: 7.25, y: 5.65, w: 4.85, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle",
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 6 — 작동 방식 / 지능형 엔진 파이프라인
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "How it works · 지능형 엔진");
  title(s, [
    { text: "복잡한 사고 과정을 ", options: { color: C.fg } },
    { text: "AI가 대신 수행", options: { color: C.accent } },
    { text: "하는 파이프라인", options: { color: C.fg } },
  ]);

  const stages = [
    { t: "원본 텍스트\n입력", sub: "Input", fill: C.bg2 },
    { t: "핵심 내용 요약 &\n톤앤매너 매핑", sub: "GPT-4o", fill: C.panel },
    { t: "모바일 가독성용\n슬라이드 분할 계산", sub: "Layout AI", fill: C.panel },
    { t: "디자인 템플릿 매핑 &\n이미지 추천", sub: "Fabric.js", fill: C.panel },
    { t: "최종 카드뉴스\n5장 렌더링", sub: "Output", fill: C.bg2 },
  ];
  const n = stages.length;
  const boxW = 2.05, gap = 0.28;
  const totalW = n * boxW + (n - 1) * gap;
  let x = (W - totalW) / 2;
  const y = 3.3;
  stages.forEach((st, i) => {
    const isEnd = i === 0 || i === n - 1;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: boxW, h: 2.0, rectRadius: 0.12,
      fill: { color: st.fill },
      line: { color: isEnd ? C.line : C.accent, width: isEnd ? 1 : 1.5 },
    });
    s.addText(st.sub.toUpperCase(), {
      x, y: y + 0.2, w: boxW, h: 0.3, fontFace: FONT_MONO, fontSize: 9, bold: true,
      color: isEnd ? C.dim : C.accent, align: "center", charSpacing: 1,
    });
    s.addText(st.t, {
      x: x + 0.1, y: y + 0.55, w: boxW - 0.2, h: 1.3, fontFace: FONT, fontSize: 13.5, bold: true,
      color: C.fg, align: "center", valign: "middle", lineSpacing: 18,
    });
    if (i < n - 1) {
      s.addText("→", {
        x: x + boxW - 0.05, y, w: gap + 0.1, h: 2.0,
        fontFace: FONT, fontSize: 18, color: C.accent, align: "center", valign: "middle",
      });
    }
    x += boxW + gap;
  });

  s.addText(
    "생성형 AI의 발전으로, 과거에는 불가능했던 '문맥 기반의 레이아웃 자동화'가 완전히 가능해졌습니다.",
    { x: 0.9, y: 5.85, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 14, italic: true, color: C.muted, align: "center" }
  );
  footer(s);
})();

// ===========================================================================
// SLIDE 7 — 기술 아키텍처 & 스택
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Architecture · 기술 스택");
  title(s, [
    { text: "프론트 · 백엔드 · AI · 배포까지 ", options: { color: C.fg } },
    { text: "1인 풀스택", options: { color: C.accent } },
  ]);

  const layers = [
    { k: "Frontend", v: "Next.js 16 (App Router) · React 19", d: "Quick Test UX · Figma 스타일 캔버스 에디터" },
    { k: "Design Engine", v: "Fabric.js (클라이언트 합성)", d: "정밀 객체 조작 · 스냅 · 텍스트 정밀 제어" },
    { k: "AI", v: "OpenAI GPT-4o Vision · GPT Image / DALL·E 3", d: "레퍼런스 분석 · 요약·톤 매핑 · 이미지 생성" },
    { k: "Backend · DB", v: "Prisma 7 · PostgreSQL (Neon)", d: "GeneratedCard 스키마 · 마이그레이션 자동화" },
    { k: "Deploy", v: "Vercel / Railway · Docker", d: "CI 배포 · 환경변수 자동화" },
  ];
  layers.forEach((l, i) => {
    const y = 2.95 + i * 0.78;
    card(s, 0.9, y, 11.5, 0.66, C.bg2);
    s.addText(l.k, {
      x: 1.15, y, w: 2.4, h: 0.66, fontFace: FONT_MONO, fontSize: 12, bold: true, color: C.accent, valign: "middle",
    });
    s.addText(l.v, {
      x: 3.7, y, w: 4.4, h: 0.66, fontFace: FONT, fontSize: 13, bold: true, color: C.fg, valign: "middle",
    });
    s.addText(l.d, {
      x: 8.2, y, w: 4.0, h: 0.66, fontFace: FONT, fontSize: 11, color: C.muted, valign: "middle",
    });
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 8 — 기술적 도전 & 해결
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Engineering · 가장 큰 기술 도전");
  title(s, [
    { text: "부분 수정이 아니라 ", options: { color: C.fg } },
    { text: "아키텍처를 통째로 전환", options: { color: C.accent } },
  ]);

  // 문제
  card(s, 0.9, 2.95, 5.5, 3.1, C.bg2);
  s.addText("문제", { x: 1.2, y: 3.15, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: "FF6B6B" });
  s.addText([
    { text: "서버 Puppeteer/Chromium 이미지 렌더가\n배포(Railway)에서 반복 실패", options: { bold: true, color: C.fg } },
    { text: "\ncrashpad · libnss3 · Node 버전 충돌 →\nchromium-min → full → Node18 → Node20 …\n끝없는 땜질의 악순환", options: { color: C.muted } },
  ], { x: 1.2, y: 3.6, w: 4.9, h: 2.2, fontFace: FONT, fontSize: 13, lineSpacing: 20 });

  // 해결
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.95, y: 2.95, w: 5.45, h: 3.1, rectRadius: 0.14,
    fill: { color: C.panel }, line: { color: C.good, width: 1.5 },
  });
  s.addText("해결", { x: 7.25, y: 3.15, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.good });
  s.addText([
    { text: "서버 렌더링을 버리고\n클라이언트 Fabric.js 합성으로 전환", options: { bold: true, color: C.fg } },
    { text: "\n→ 인프라 의존성 제거 · 배포 안정화\n→ 즉각적인 미리보기 · 비용 절감\n→ 에디터 기능과 자연스럽게 통합", options: { color: C.accent2 } },
  ], { x: 7.25, y: 3.6, w: 4.9, h: 2.2, fontFace: FONT, fontSize: 13, lineSpacing: 20 });

  // 커밋 코드박스
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.9, y: 6.2, w: 11.5, h: 0.62, rectRadius: 0.08, fill: { color: "08080C" }, line: { color: C.line, width: 1 },
  });
  s.addText([
    { text: "- ", options: { color: "FF6B6B" } },
    { text: "서버 Chromium 렌더 (crashpad·libnss3·Node 버전 지옥)     ", options: { color: "FF8888" } },
    { text: "+ ", options: { color: C.good } },
    { text: "feat: 카드 렌더를 클라이언트 Fabric.js 합성으로 교체 (#19)", options: { color: C.good } },
  ], { x: 1.15, y: 6.2, w: 11.0, h: 0.62, fontFace: FONT_MONO, fontSize: 10.5, valign: "middle" });
  footer(s);
})();

// ===========================================================================
// SLIDE — 정보추출(IE) 파이프라인 (실제 구현)
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "LLM Engineering · 정보추출(IE)");
  title(s, [
    { text: "자유형 텍스트를 ", options: { color: C.fg } },
    { text: "결정적 구조 데이터", options: { color: C.accent } },
    { text: "로\n변환하는 IE 파이프라인", options: { color: C.fg } },
  ]);

  const stages = [
    { t: "Load", sub: "URL / 텍스트", d: "cheerio 본문·메타 추출" },
    { t: "Clean", sub: "정제", d: "보일러플레이트 제거·길이 제한" },
    { t: "Extract", sub: "GPT-4o-mini", d: "structured outputs\nJSON Schema(strict)" },
    { t: "Verify", sub: "정합성", d: "슬라이드 역할 보정" },
  ];
  const n = stages.length;
  const boxW = 2.55, gap = 0.32;
  const totalW = n * boxW + (n - 1) * gap;
  let x = (W - totalW) / 2;
  const y = 3.15;
  stages.forEach((st, i) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: boxW, h: 1.9, rectRadius: 0.12,
      fill: { color: C.panel }, line: { color: C.accent, width: 1.3 },
    });
    s.addText(st.t, {
      x, y: y + 0.18, w: boxW, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.fg, align: "center",
    });
    s.addText(st.sub, {
      x, y: y + 0.62, w: boxW, h: 0.3, fontFace: FONT_MONO, fontSize: 9.5, color: C.accent, align: "center",
    });
    s.addText(st.d, {
      x: x + 0.12, y: y + 0.95, w: boxW - 0.24, h: 0.8, fontFace: FONT, fontSize: 10.5, color: C.muted, align: "center", lineSpacing: 14,
    });
    if (i < n - 1) {
      s.addText("→", { x: x + boxW - 0.06, y, w: gap + 0.12, h: 1.9, fontFace: FONT, fontSize: 18, color: C.accent, align: "center", valign: "middle" });
    }
    x += boxW + gap;
  });

  // 출력 스키마 코드박스
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.9, y: 5.35, w: 11.5, h: 1.0, rectRadius: 0.08, fill: { color: "08080C" }, line: { color: C.line, width: 1 },
  });
  s.addText([
    { text: "// POST /api/extract → CardBrief\n", options: { color: C.dim } },
    { text: "{ headline, summary, key_points[], ", options: { color: "CDD3DF" } },
    { text: "entities[]", options: { color: C.accent2 } },
    { text: ", tone, ", options: { color: "CDD3DF" } },
    { text: "slides[]", options: { color: C.accent2 } },
    { text: " }  → 카드뉴스 컴포지터로 연결", options: { color: "CDD3DF" } },
  ], { x: 1.2, y: 5.5, w: 11.0, h: 0.75, fontFace: FONT_MONO, fontSize: 11, valign: "middle", lineSpacing: 18 });
  footer(s);
})();

// ===========================================================================
// SLIDE 9 — 개발 과정 & 성과
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Process & Results · 개발 과정");
  title(s, [
    { text: "AI 페어 코딩으로 ", options: { color: C.fg } },
    { text: "기획부터 배포까지 한 흐름", options: { color: C.accent } },
  ]);

  const stats = [
    { n: "2일", l: "골격을 거의 다 뽑은\n집중 스프린트" },
    { n: "50+", l: "이틀간 쌓인 커밋\n(전체의 90%+)" },
    { n: "13만", l: "Threads 조회수로\n검증한 시장 수요" },
    { n: "1인", l: "기획·프론트·백·AI·\n배포 풀스택" },
  ];
  stats.forEach((st, i) => {
    const x = 0.9 + i * 2.95;
    card(s, x, 3.0, 2.7, 1.85);
    s.addText(st.n, {
      x: x + 0.25, y: 3.2, w: 2.2, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.accent,
    });
    s.addText(st.l, {
      x: x + 0.25, y: 4.05, w: 2.25, h: 0.7, fontFace: FONT, fontSize: 11.5, color: C.muted, lineSpacing: 16,
    });
  });

  s.addText("핵심 작업 방식", {
    x: 0.9, y: 5.2, w: 5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent2,
  });
  s.addText([
    { text: "아키텍처 전환·반복 픽스를 AI에게 통째로 위임하고 사람은 방향을 결정", options: { bullet: { code: "25B8", indent: 16 }, color: C.fg } },
    { text: "MCP로 디자인·DB·배포·문서를 한 창에서 연결한 '작업 비서' 워크플로우", options: { bullet: { code: "25B8", indent: 16 }, color: C.fg } },
    { text: "웹·모바일에서 브랜치·PR까지 — 로컬 터미널 없이 어디서든 개발 진행", options: { bullet: { code: "25B8", indent: 16 }, color: C.fg } },
  ], { x: 0.9, y: 5.65, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.4 });
  footer(s);
})();

// ===========================================================================
// SLIDE 10 — 비즈니스 모델 & 로드맵
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  base(s);
  kicker(s, "Business & Roadmap");
  title(s, [
    { text: "단발성 툴이 아닌, ", options: { color: C.fg } },
    { text: "고객의 성장을 견인하는 구독 BM", options: { color: C.accent } },
  ]);

  // 플라이휠 (좌측)
  s.addText("The Content Flywheel", {
    x: 0.9, y: 3.0, w: 5.3, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.accent2,
  });
  const wheel = [
    "제작 시간의 압도적 단축 (SaaS 사용)",
    "콘텐츠 업로드 빈도 · 일관성 증가",
    "SNS 조회수 · 인게이지먼트 성장",
    "정기 구독 유지 및 락인(Lock-in)",
  ];
  s.addText(wheel.map((w2, i) => ({
    text: `${i + 1}. ${w2}`,
    options: { color: C.fg, paraSpaceAfter: 8 },
  })), { x: 0.9, y: 3.5, w: 5.3, h: 2.6, fontFace: FONT, fontSize: 13.5, lineSpacingMultiple: 1.3 });
  s.addText("→ 매주 콘텐츠를 발행해야 하므로 '월간 구독 인프라'로 자리 잡습니다.", {
    x: 0.9, y: 5.85, w: 5.3, h: 0.7, fontFace: FONT, fontSize: 11.5, italic: true, color: C.muted, lineSpacing: 16,
  });

  // 로드맵 (우측)
  s.addText("Roadmap", {
    x: 6.7, y: 3.0, w: 5.7, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.accent2,
  });
  const road = [
    { p: "DONE", t: "차세대 이미지 생성 엔진 · 캔버스 에디터 V2", c: C.good },
    { p: "DONE", t: "DB 스키마 · Neon 연동 · 마이그레이션 자동화", c: C.good },
    { p: "NEXT", t: "보관함 — 생성 카드뉴스 영구 저장·개인 갤러리", c: C.accent },
    { p: "NEXT", t: "프리미엄 빌링 — 사용량 대시보드·구독 요금제", c: C.purple },
  ];
  road.forEach((r, i) => {
    const y = 3.5 + i * 0.72;
    card(s, 6.7, y, 5.7, 0.6, C.bg2);
    s.addShape(pptx.ShapeType.roundRect, {
      x: 6.9, y: y + 0.13, w: 0.85, h: 0.34, rectRadius: 0.17,
      fill: { color: r.c }, line: { type: "none" },
    });
    s.addText(r.p, {
      x: 6.9, y: y + 0.13, w: 0.85, h: 0.34, fontFace: FONT_MONO, fontSize: 9, bold: true,
      color: "0E0E14", align: "center", valign: "middle",
    });
    s.addText(r.t, {
      x: 7.9, y, w: 4.4, h: 0.6, fontFace: FONT, fontSize: 12, color: C.fg, valign: "middle",
    });
  });
  footer(s);
})();

// ===========================================================================
// SLIDE 11 — Closing
// ===========================================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W * 0.55, h: 0.09,
    fill: { color: C.accent }, line: { type: "none" },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: W * 0.55, y: 0, w: W * 0.45, h: 0.09,
    fill: { color: C.purple }, line: { type: "none" },
  });
  s.addText("검증된 시장 · 준비된 기술 · 이를 증명한 실행", {
    x: 0.9, y: 2.2, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: C.accent, align: "center",
  });
  s.addText([
    { text: "디자인의 장벽을 허물고\n", options: { color: C.fg } },
    { text: "누구나 크리에이터가 되는 세상", options: { color: C.accent } },
  ], {
    x: 0.9, y: 2.9, w: 11.5, h: 1.8, fontFace: FONT, fontSize: 40, bold: true, align: "center", lineSpacing: 50,
  });
  s.addText("Market Need · Tech Enabler · Founder Fit — 가장 빠르고 날카롭게 문제를 해결할 최적의 타이밍", {
    x: 0.9, y: 4.9, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 14, color: C.muted, align: "center",
  });

  chips(s, ["Next.js 16", "React 19", "OpenAI GPT-4o", "Fabric.js", "Prisma · Neon", "Vercel"], 3.0, 5.7, 7.3);

  s.addText("Hyunmin Han · 2026   ·   감사합니다 🙌", {
    x: 0.9, y: 6.7, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.dim, align: "center",
  });
})();

// ---- Write -----------------------------------------------------------------
const outPath = path.join(__dirname, "..", "scratch", "carnews-automation-portfolio.pptx");
pptx.writeFile({ fileName: outPath }).then((f) => {
  console.log("✅ 생성 완료:", f);
});
