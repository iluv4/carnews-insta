import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysisCache';
import { fallbackLayout } from '@/lib/fabricSpec';
import { buildLayoutMessages } from '@/lib/prompts';
import { MODELS, chatTuning } from '@/lib/models';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

function hasKey(): boolean {
  const k = process.env.OPENAI_API_KEY;
  return !!k && k !== 'dummy_key' && k !== 'your_openai_api_key_here';
}

// The prompt that turns reference images into a STRUCTURED "Layout Template"
// (a blueprint for the deterministic Fabric.js compositor) lives in
// '@/lib/prompts'. Note: this is NOT the old free-form "Design DNA" that fed an
// image generator — the two formats are intentionally incompatible, and
// transform's parseLayout falls back to a default layout for legacy DNA inputs.

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
      model: MODELS.vision,
      response_format: { type: 'json_object' },
      ...chatTuning(MODELS.vision, { maxOutputTokens: 1200 }),
      messages: buildLayoutMessages(slice) as OpenAI.Chat.ChatCompletionMessageParam[],
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
