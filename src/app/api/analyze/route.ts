import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysisCache';
import { fallbackLayout } from '@/lib/fabricSpec';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

function hasKey(): boolean {
  const k = process.env.OPENAI_API_KEY;
  return !!k && k !== 'dummy_key' && k !== 'your_openai_api_key_here';
}

// Output is a STRUCTURED "Layout Template" (a blueprint for the deterministic
// Fabric.js compositor) — NOT the old free-form "Design DNA" that fed an image
// generator. The two formats are intentionally incompatible; transform's
// parseLayout falls back to a default layout for legacy DNA inputs.
const REFERENCE_PROMPT = `You analyse Korean Instagram card-news references and produce a reusable "Layout Template" JSON.
The template will drive a deterministic Fabric.js compositor — be CONCRETE, not poetic.

Return STRICTLY this JSON shape (no markdown, no commentary):

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
- Output JSON only.`;

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const imageUrls: string[] = body.imageUrls || (body.imageUrl ? [body.imageUrl] : []);
    const cacheKey: string | undefined = body.cacheKey;

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Namespaced `layout:` so it never collides with old "Design DNA" cache
    // entries (different, incompatible format).
    if (cacheKey) {
      const cached = await getCachedAnalysis(`layout:${cacheKey}`);
      if (cached) {
        console.log('[analyze] layout cache hit for', cacheKey);
        return NextResponse.json({ analysis: cached, cached: true });
      }
    }

    if (!hasKey()) {
      const dummy = JSON.stringify(fallbackLayout(3));
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ analysis: dummy, provider: 'fallback-dummy' });
    }

    const slice = imageUrls.slice(0, 3);
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      max_tokens: 1200,
      messages: [
        { role: 'system', content: 'You output ONLY JSON. No markdown.' },
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: REFERENCE_PROMPT },
            ...slice.map((img) => ({ type: 'image_url' as const, image_url: { url: img } })),
          ],
        },
      ],
    });

    let analysis = res.choices[0].message.content ?? '';
    // Validate; fall back to a sane default layout if the model returned junk.
    try {
      const parsed = JSON.parse(analysis);
      if (!parsed || parsed.type !== 'layout' || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        analysis = JSON.stringify(fallbackLayout(slice.length || 3));
      }
    } catch {
      analysis = JSON.stringify(fallbackLayout(slice.length || 3));
    }

    if (cacheKey) {
      await setCachedAnalysis(`layout:${cacheKey}`, analysis);
    }

    console.log(`[analyze] layout in ${Date.now() - t0}ms`);
    return NextResponse.json({ analysis, provider: 'openai' });
  } catch (error) {
    const detail =
      (error as { error?: { message?: string }; message?: string })?.error?.message ||
      (error as Error)?.message ||
      String(error);
    console.error('[analyze] route error:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
