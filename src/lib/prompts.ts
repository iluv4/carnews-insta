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
