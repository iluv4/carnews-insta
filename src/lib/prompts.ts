// ---------------------------------------------------------------------------
// Prompt & Context Engineering library
// ---------------------------------------------------------------------------
// Single source of truth for every LLM instruction in the project.
//
// Why this file exists
// --------------------
// Prompts used to live inline inside each route handler. That made them
// impossible to review, diff, reuse, or A/B test, and the quality drifted
// per-endpoint. This module centralises them and applies a consistent
// engineering structure to each one:
//
//   Role  →  Instruction  →  Context  →  Constraints  →  Output contract  →  Few-shot
//
// Every builder returns a ready-to-send OpenAI `messages` array (system +
// user), so callers stay thin and the *prompt* is the reviewable artifact.
//
// Conventions
//   - The system message owns identity + the output contract (what shape, no
//     prose). It is the most stable layer, which also makes it the natural unit
//     for prompt caching later.
//   - The user message owns the variable context (this request's data).
//   - Constraints are stated positively ("return X") and negatively ("never Y")
//     because models follow explicit guardrails far more reliably than implied
//     ones.
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
};

// ===========================================================================
// 1. Reference layout analysis  (used by /api/analyze)
// ===========================================================================
// Vision task: read 1–3 Korean Instagram card-news images and emit a concrete,
// reusable "Layout Template" that drives a deterministic Fabric.js compositor.
// The output is a strict JSON contract — poetic "design DNA" is explicitly
// out of scope because the downstream consumer is code, not an image model.

const LAYOUT_SYSTEM =
  'You are a senior Korean social-media art director who reverse-engineers ' +
  'Instagram card-news designs into structured layout blueprints. ' +
  'You output ONLY a single JSON object that matches the requested schema — ' +
  'no markdown fences, no commentary, no trailing text.';

const LAYOUT_INSTRUCTION = `Analyse the provided Korean Instagram card-news reference image(s) and produce a reusable "Layout Template" JSON.
The template will drive a deterministic Fabric.js compositor — be CONCRETE, not poetic.

Return STRICTLY this JSON shape:

{
  "type": "layout",
  "slides": [
    {
      "role": "cover" | "review" | "menu" | "cta" | "info" | "closing",
      "bg": "photo-fullbleed" | "photo-collage" | "color",
      "title": {
        "pos": "top-left" | "top-center" | "top-right" | "middle-left" | "middle-center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right",
        "weight": 700-900,
        "color": "#hex",
        "accent_bar": "left" | "none"
      },
      "body": {
        "pos": "...",
        "style": "emoji-bullet" | "paragraph" | "none",
        "emojis": ["😍","😎","🤤"],
        "color": "#hex"
      },
      "footer": { "pos": "...", "text_role": "caption" | "cta-arrow" | "brand", "color": "#hex" }
    }
  ],
  "palette": { "primary": "#hex", "accent": "#hex", "text": "#hex", "overlay": "rgba(0,0,0,0.45)" },
  "typography": { "family": "Pretendard" | "SpoqaHanSansNeo" | "sans", "weight_title": 700-900, "weight_body": 400-700 },
  "decor": { "brand_mark": { "pos": "top-right", "text": "BrandName?" }, "motifs": ["left-accent-bar","emoji-bullet","arrow-cta","badge-circle"] }
}

Rules:
- One element per slide is required.
- "slides" length should match the count of reference images provided (default 3 if unsure).
- If a slide uses a "|" left accent bar before the title, set accent_bar="left".
- If body uses emoji bullets like 😍😎🤤 list emojis (3 typical).
- Pick "overlay" rgba opacity matching the actual dark overlay over photos (0.3–0.6).
- Read colors from the pixels, not from assumptions — sample the dominant hues you actually see.
- Output JSON only.`;

/**
 * Build the message payload for the reference-layout vision analysis.
 * Caller is responsible for slicing/limiting the image list (≤3 recommended).
 */
export function buildLayoutMessages(imageUrls: string[]): ChatMessage[] {
  return [
    { role: 'system', content: LAYOUT_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: LAYOUT_INSTRUCTION },
        ...imageUrls.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    },
  ];
}

// ===========================================================================
// 2. Template matching  (used by /api/match)
// ===========================================================================
// Classification task: given a free-text theme and a closed set of templates,
// pick the single best-fitting template id.
//
// The hard requirement here is grounding: the model must choose from the
// provided list and nothing else. We enforce that three ways —
//   (1) an explicit "only from this list" constraint,
//   (2) a few-shot example that demonstrates the exact I/O shape, and
//   (3) a programmatic validator (`resolveTemplateId`) that rejects any
//       hallucinated id and falls back deterministically.
// Prompt instructions reduce hallucination; the validator guarantees it.

export type MatchableTemplate = { id: string; name: string; tags?: string[] };

const MATCH_SYSTEM =
  'You are a design assistant that maps a content theme to the single ' +
  'best-fitting card-news template. You reply with exactly one template id ' +
  'from the provided list and nothing else — no quotes, no markdown, no ' +
  'explanation. If several fit, prefer the most thematically specific one; ' +
  'if none clearly fit, choose the most neutral general-purpose template.';

/**
 * Build the messages for template matching. Includes a one-shot example so the
 * model locks onto the "id-only" output contract.
 */
export function buildTemplateMatchMessages(
  theme: string,
  templates: MatchableTemplate[]
): ChatMessage[] {
  const catalog = templates
    .map((t) => {
      const tags = t.tags?.length ? ` — tags: ${t.tags.join(', ')}` : '';
      return `- id: ${t.id} | name: ${t.name}${tags}`;
    })
    .join('\n');

  // One-shot: teaches the exact selection behaviour + bare-id output.
  const fewShot = `Example
Theme: "2026년 IT 기술 트렌드 전망"
Templates:
- id: ux_trend_2026 | name: 2026 UX Trend — tags: Tech, Future
- id: magazine_news | name: Magazine News — tags: Lifestyle, Travel
Answer: ux_trend_2026`;

  const task = `Available templates:
${catalog}

${fewShot}

Now select for this theme.
Theme: "${theme}"
Answer with one id from the list above only.`;

  return [
    { role: 'system', content: MATCH_SYSTEM },
    { role: 'user', content: task },
  ];
}

/**
 * Validate the model's raw reply against the real id set. Guarantees the
 * returned id is always one the caller actually offered (anti-hallucination
 * guardrail). Tolerates quotes/whitespace and a model that echoes
 * "Answer: <id>". Falls back to the first template if nothing matches.
 */
export function resolveTemplateId(
  raw: string | null | undefined,
  templates: MatchableTemplate[]
): string | null {
  if (!templates.length) return null;
  const ids = new Set(templates.map((t) => t.id));
  const fallback = templates[0].id;
  if (!raw) return fallback;

  const cleaned = raw
    .trim()
    .replace(/^answer\s*:?\s*/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .trim();

  if (ids.has(cleaned)) return cleaned;

  // Last resort: a valid id appearing somewhere inside a chattier reply.
  const found = templates.find((t) => cleaned.includes(t.id));
  return found ? found.id : fallback;
}

// ===========================================================================
// 3. Amazon listing copy  (used by /api/generate-amazon)
// ===========================================================================
// Structured generation: produce localized marketing copy for six fixed
// listing slides as a strict JSON object.
//
// Beyond the output contract, this prompt carries real safety guards. Amazon
// rejects listings with unsubstantiated medical/curative claims and
// fabricated statistics, so the system message forbids them explicitly. The
// failure mode of a thin prompt here isn't ugly copy — it's a policy takedown.

export type AmazonCopyInput = {
  productName: string;
  brand: string;
  ingredients: string;
  benefits: string;
  howToUse: string;
  lang: string;
};

function langGuide(lang: string): string {
  if (lang === 'ja') return '日本語で';
  if (lang === 'ko') return '한국어로';
  return 'in English';
}

/**
 * Build the messages for Amazon listing copy generation. Returns localized,
 * compliance-aware copy in a fixed six-slide JSON contract.
 */
export function buildAmazonCopyMessages(input: AmazonCopyInput): ChatMessage[] {
  const { productName, brand, ingredients, benefits, howToUse, lang } = input;

  const system =
    `You are an expert Amazon listing copywriter specializing in beauty and ` +
    `lifestyle products. Write all copy ${langGuide(lang)} in a confident, ` +
    `benefit-led tone that reads naturally to native speakers — never ` +
    `machine-translated.\n` +
    `Hard rules (Amazon policy + quality):\n` +
    `- Never make medical, curative, or disease-treatment claims.\n` +
    `- Never invent statistics, certifications, or clinical results; if a ` +
    `number is needed, keep it modest and clearly experiential (e.g. ` +
    `satisfaction), not a fabricated lab figure.\n` +
    `- Stay specific to the product data given; do not hallucinate ` +
    `ingredients or features that were not provided.\n` +
    `- Respect each slide's character budget so text fits the image layout: ` +
    `taglines and headers short and punchy, descriptions one tight line.\n` +
    `Return ONLY a JSON object matching the requested structure.`;

  const user = `Product data
- Product: ${productName}
- Brand: ${brand}
- Key ingredients: ${ingredients}
- Benefits: ${benefits}
- How to use: ${howToUse}

Generate copy for the six listing-image slides. Return JSON with this exact structure:
{
  "slide1": { "brand": "...", "productName": "...", "tagline": "..." },
  "slide2": { "header": "...", "points": [{"icon": "✓", "title": "...", "desc": "..."}] (exactly 4 items) },
  "slide3": { "header": "...", "mainIngredient": "...", "details": [{"name": "...", "pct": "...", "benefit": "..."}] (exactly 3 items) },
  "slide4": { "header": "HOW TO USE", "steps": [{"no": "01", "title": "...", "desc": "..."}] (exactly 3 items) },
  "slide5": { "header": "...", "beforeLabel": "...", "afterLabel": "...", "result1": "...", "result2": "..." },
  "slide6": { "header": "...", "claim": "...", "sub": "..." }
}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ===========================================================================
// 4. Prompt refinement + personas  (used by /api/refine-prompt)
// ===========================================================================
// "내가 프롬프트 쓰기 귀찮다" 를 위한 단계. 사용자가 대충 던진 한 줄을, 선택한
// 페르소나(역할)에 맞춰 구체적이고 카드뉴스 생성 파이프라인이 바로 먹을 수 있는
// 주제 문장으로 다듬어준다.
//
// 설계 의도
//   - 페르소나는 UI(칩 선택)와 프롬프트(역할 주입) 양쪽에서 같은 정의를 공유해야
//     하므로 여기 한 곳에서만 선언한다(Single source of truth).
//   - 출력은 항상 JSON 한 덩어리. refined 는 곧바로 topic 으로 흘러가고, 파이프라인
//     입장에선 "사람이 잘 쓴 주제"와 구분되지 않는다 — 즉 이 단계는 투명한 전처리.
//   - 모델은 "주제를 대신 결정"하면 안 된다. 사용자의 원래 의도를 유지한 채 살을
//     붙이는 것이 일이라, 새 소재를 지어내지 말라고 명시적으로 막는다.

export type Persona = {
  id: string;
  /** UI 칩에 보이는 라벨 */
  label: string;
  emoji: string;
  /** 다듬어진 주제에 주입될 역할 한 줄 */
  role: string;
  /** 톤·관점 가이드 (프롬프트에만 사용, UI 설명으로도 재사용) */
  guide: string;
};

/**
 * 선택 가능한 페르소나 목록. 칩을 누르면 해당 role 이 자동으로 부여되고, 다듬기
 * 결과가 그 역할의 관점/톤으로 맞춰진다. 첫 항목이 기본 선택값이다.
 */
export const PERSONAS: Persona[] = [
  {
    id: 'free',
    label: '자유 (역할 없음)',
    emoji: '🪄',
    role: '범용 카드뉴스 기획자',
    guide:
      '특정 분야에 치우치지 말고, 원문 의도를 가장 자연스럽게 살리는 중립적인 톤으로 다듬어라.',
  },
  {
    id: 'car_news_editor',
    label: '자동차 뉴스 에디터',
    emoji: '🚗',
    role: '신차·모빌리티 트렌드를 다루는 자동차 전문 뉴스 에디터',
    guide:
      '모델명·스펙·출시 시점·가격대 같은 구체 정보를 끌어내고, 과장 없이 팩트 중심의 뉴스 톤으로 다듬어라.',
  },
  {
    id: 'food_travel',
    label: '맛집·여행 인플루언서',
    emoji: '🍜',
    role: '현장 경험을 생생하게 전하는 맛집·여행 인플루언서',
    guide:
      '장소·메뉴·계절감·"가야 하는 이유"를 살리고, 친근하고 군침 도는 톤으로 다듬어라.',
  },
  {
    id: 'marketer',
    label: '브랜드 마케터',
    emoji: '📈',
    role: '전환을 끌어내는 브랜드 소셜 마케터',
    guide:
      '타깃 고객·핵심 베네핏·행동 유도(CTA)를 또렷하게 하고, 설득력 있되 허위·과장 주장은 배제한 톤으로 다듬어라.',
  },
  {
    id: 'tech_curator',
    label: 'IT·트렌드 큐레이터',
    emoji: '🧠',
    role: '복잡한 기술을 쉽게 풀어내는 IT·트렌드 큐레이터',
    guide:
      '왜 지금 중요한지, 무엇이 바뀌는지를 또렷한 인사이트로 정리하고, 똑똑하지만 잘난 척하지 않는 톤으로 다듬어라.',
  },
];

/** id 로 페르소나를 찾고, 없으면 첫 번째(기본)로 폴백한다. */
export function resolvePersona(id: string | null | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

const REFINE_SYSTEM =
  'You are a Korean prompt engineer for an Instagram card-news generator. ' +
  'A user hands you a rough, lazy one-liner; you rewrite it into a single ' +
  'concrete, vivid Korean topic sentence that the downstream pipeline can ' +
  'use directly. You ALWAYS reply with ONE JSON object — no markdown fences, ' +
  'no commentary.';

/**
 * 대충 쓴 프롬프트 + 선택한 페르소나를 받아, 그 역할의 관점으로 다듬은 주제를
 * 만들어내는 메시지를 구성한다. 결과 JSON 의 `refined` 가 곧 새 topic 이 된다.
 */
export function buildPromptRefineMessages(
  rawPrompt: string,
  persona: Persona
): ChatMessage[] {
  const user = `사용자가 대충 입력한 프롬프트:
"""${rawPrompt}"""

부여된 역할(페르소나): ${persona.role}
이 역할의 톤·관점 가이드: ${persona.guide}

위 역할의 관점에서, 사용자의 원래 의도를 유지한 채 카드뉴스 주제를 구체적이고
매력적인 한국어 한 문장으로 다듬어라.

규칙:
- 사용자가 말하지 않은 새 소재·사실을 지어내지 마라. 모호하면 더 구체적으로 만들되,
  의미를 바꾸지는 마라.
- 결과는 슬라이드 카드뉴스의 "주제"로 바로 쓸 수 있어야 한다 (질문이 아니라 진술문).
- 너무 길게 늘리지 말 것. 한눈에 읽히는 한 문장.

정확히 이 JSON 형태로만 출력하라:
{
  "refined": "다듬어진 주제 한 문장",
  "notes": "무엇을 어떻게 바꿨는지 한 줄 설명 (한국어)"
}`;

  return [
    { role: 'system', content: REFINE_SYSTEM },
    { role: 'user', content: user },
  ];
}
