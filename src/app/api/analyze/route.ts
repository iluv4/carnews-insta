import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysisCache';

export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept imageUrls (array) or legacy imageUrl (single)
    const imageUrls: string[] = body.imageUrls || (body.imageUrl ? [body.imageUrl] : []);
    const cacheKey: string | undefined = body.cacheKey;

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Return cached result if available (saves API cost on repeated analysis)
    if (cacheKey) {
      const cached = await getCachedAnalysis(cacheKey);
      if (cached) {
        console.log('[analyze] DB cache hit for', cacheKey);
        return NextResponse.json({ analysis: cached, cached: true });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('[analyze] API key present:', !!apiKey, '| images:', imageUrls.length);
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      const dummyJsonl =
`{"type":"background", "color":"#1a1a1a", "style":"gradient"}
{"type":"title", "content":"카드뉴스 제목 예시", "color":"#ffffff", "position":"top-center", "fontSize":"large"}
{"type":"body", "content":"이곳에 본문 내용이 들어갑니다. 카드뉴스의 핵심 메시지를 분석하여 추출합니다.", "color":"#dddddd", "position":"center", "fontSize":"medium"}
{"type":"graphic_element", "description":"A glowing neon circle", "position":"bottom-right"}`;

      await new Promise(resolve => setTimeout(resolve, 2000));
      return NextResponse.json({ analysis: dummyJsonl });
    }

    // Images arrive as data: base64 strings from the client
    const base64Images = imageUrls.slice(0, 5);
    console.log(`[analyze] receiving ${base64Images.length} base64 images`);

    const imageBlocks = base64Images.map(img => ({
      type: "image_url" as const,
      image_url: { url: img },
    }));

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are a world-class Senior UI/UX Designer and Design Analyst specializing in Korean Instagram card news (카드뉴스). Extract every visual detail with pixel-level precision for faithful style replication."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these ${base64Images.length} Korean Instagram card news reference image(s) and synthesize a unified Design DNA. Be exhaustive — your output feeds directly into an AI image generator that must faithfully replicate this visual style.

Extract ALL of the following as individual JSONL lines:
1. background_dna: exact HEX colors, gradient direction/stops, texture type (grain/noise level, glassmorphism opacity), any overlay patterns
2. typography_dna: font weight (100-900), style (sans-serif/serif/display), size hierarchy ratios, letter-spacing, line-height, text color(s), shadow/outline specs, alignment
3. layout_dna: grid structure, element positioning (top-heavy/centered/split), padding/margin rhythm, aspect ratio usage, z-layer stacking
4. color_palette: list every HEX color used with role (primary/accent/text/bg/overlay)
5. graphic_elements_dna: border-radius values, stroke widths, shadow blur/spread, shape types, icon style, decorative motifs
6. photo_treatment_dna: photo filter style (warm/cool/desaturated/vivid), vignette, blur usage, photo-to-graphic ratio
7. subject_dna: what/who is in the photos, framing (close-up/full-body/product), lighting mood, background setting
8. brand_mood_dna: 5 precise adjectives describing the overall aesthetic feel

OUTPUT: Strictly JSONL — one JSON object per line, no markdown, no code fences.
Example lines:
{"type":"background_dna","primary":"#0a0a0a","secondary":"#1f1f1f","texture":"subtle_grain","gradient":"linear 180deg #0a0a0a→#1f1f1f"}
{"type":"typography_dna","weight":"800","family":"sans-serif","primary_color":"#ffffff","accent_color":"#ff6b35","alignment":"center","shadow":"2px 2px 8px rgba(0,0,0,0.8)"}
{"type":"color_palette","colors":["#0a0a0a","#ffffff","#ff6b35","#1f1f1f"]}
{"type":"subject_dna","description":"Korean woman, close-up portrait, warm studio lighting, soft smile, blurred neutral background"}`
            },
            ...imageBlocks,
          ],
        },
      ],
      max_tokens: 2000,
    });

    const analysis = visionResponse.choices[0].message.content;

    if (cacheKey && analysis) {
      await setCachedAnalysis(cacheKey, analysis);
      console.log('[analyze] saved to DB cache for', cacheKey);
    }

    return NextResponse.json({ analysis });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Error in OpenAI Analysis route:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
