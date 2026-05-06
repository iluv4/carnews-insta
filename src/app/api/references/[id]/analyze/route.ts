import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import type { LayoutAnalysisResult, ReferenceImage } from '@/lib/types';

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

const STRUCTURED_ANALYSIS_PROMPT = `You are a world-class Senior UI/UX Designer specializing in Korean Instagram card news (카드뉴스).

Analyze the provided reference image(s) and return a SINGLE valid JSON object (no markdown, no code fences) with this exact structure:

{
  "reference_summary": {
    "content_type": "instagram_carousel | single_post | reel_thumbnail",
    "best_use_cases": ["up to 3 Korean business types e.g. 카페, 뷰티샵"],
    "overall_mood": ["3-5 Korean adjectives e.g. 프리미엄, 미니멀, 정보형"]
  },
  "canvas": {
    "detected_ratio": "4:5 | 1:1 | 9:16",
    "recommended_width": 1080,
    "recommended_height": 1350
  },
  "global_style": {
    "palette": {
      "background": "#hexcolor",
      "text": "#hexcolor",
      "accent": "#hexcolor"
    },
    "typography": {
      "headline": { "style": "bold sans-serif", "estimated_size": 72, "weight": 800 },
      "body": { "style": "regular sans-serif", "estimated_size": 34, "weight": 400 }
    },
    "spacing": { "outer_margin": 80, "section_gap": 32 }
  },
  "slides": [
    {
      "slide_no": 1,
      "role": "cover | intro | problem | solution | tip | offer | cta | info | closing",
      "layout_type": "full_bleed_photo | full_bleed_photo_bottom_text | full_bleed_photo_top_text | text_only | split_text_image | card_stack | centered_headline | product_focus | info_grid",
      "zones": [
        { "id": "bg", "type": "image", "x": 0, "y": 0, "w": 1080, "h": 1350 },
        { "id": "headline", "type": "text", "role": "headline", "x": 80, "y": 850, "w": 850, "h": 180,
          "style": { "fontSize": 72, "fontWeight": 800, "color": "#ffffff", "align": "left" } }
      ]
    }
  ],
  "template_rules": {
    "text_density": "low | medium | high",
    "image_dependency": "low | medium | high",
    "recommended_slide_count": 5,
    "safe_area_policy": "keep 80px outer margin"
  }
}

CRITICAL: Infer pixel coordinates (x, y, w, h) relative to a 1080×1350 canvas from the visual layout you see.
Return ONLY the JSON object. No explanation. No markdown.`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1) Load reference from DB
    const reference = await prisma.reference.findUnique({ where: { id } });
    if (!reference) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    const images = reference.imagesJson as unknown as ReferenceImage[];
    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'Reference has no images' }, { status: 422 });
    }

    // 2) Check if already analyzed
    const existing = await prisma.layoutAnalysis.findFirst({
      where: { referenceId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return NextResponse.json({
        analysisId: existing.id,
        referenceId: id,
        designDna: existing.designDnaJson,
        slidePatterns: existing.slideMapJson,
        cached: true,
      });
    }

    // 3) Dev mode fallback
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'dummy_key' || apiKey === 'your_openai_api_key_here') {
      const mock: LayoutAnalysisResult = {
        reference_summary: { content_type: 'instagram_carousel', best_use_cases: ['카페', '음식점'], overall_mood: ['따뜻한', '정보형', '깔끔한'] },
        canvas: { detected_ratio: '4:5', recommended_width: 1080, recommended_height: 1350 },
        global_style: {
          palette: { background: '#F7F3EE', text: '#111111', accent: '#FF8A00' },
          typography: {
            headline: { style: 'bold sans-serif', estimated_size: 72, weight: 800 },
            body: { style: 'regular sans-serif', estimated_size: 34, weight: 400 },
          },
          spacing: { outer_margin: 80, section_gap: 32 },
        },
        slides: [
          { slide_no: 1, role: 'cover', layout_type: 'full_bleed_photo_bottom_text',
            zones: [
              { id: 'bg', type: 'image', x: 0, y: 0, w: 1080, h: 1350 },
              { id: 'headline', type: 'text', role: 'headline', x: 80, y: 850, w: 850, h: 180,
                style: { fontSize: 72, fontWeight: 800, color: '#ffffff', align: 'left' } },
              { id: 'subcopy', type: 'text', role: 'subcopy', x: 80, y: 1060, w: 760, h: 60,
                style: { fontSize: 34, fontWeight: 400, color: '#ffffffcc', align: 'left' } },
            ] },
        ],
        template_rules: { text_density: 'low', image_dependency: 'high', recommended_slide_count: 5, safe_area_policy: 'keep 80px outer margin' },
      };
      const saved = await prisma.layoutAnalysis.create({
        data: {
          referenceId: id,
          rawAnalysisJson: mock as any,
          designDnaJson: mock.global_style as any,
          slideMapJson: mock.slides as any,
        },
      });
      await prisma.reference.update({ where: { id }, data: { status: 'analyzed' } });
      return NextResponse.json({ analysisId: saved.id, referenceId: id, designDna: mock.global_style, slidePatterns: mock.slides });
    }

    // 4) Convert image URLs → base64 for GPT Vision
    const origin = new URL(req.url).origin;
    const imageBlocks = await Promise.all(
      images.slice(0, 5).map(async (img) => {
        // Proxy instagram images to avoid CORS
        const proxyUrl = img.url.includes('instagram.com') || img.url.includes('cdninstagram.com')
          ? `${origin}/api/proxy/base64?url=${encodeURIComponent(img.url)}`
          : img.url;

        try {
          const r = await fetch(proxyUrl);
          const data = await r.json();
          const b64: string = data.base64 || img.url;
          const mimeMatch = b64.match(/^data:(image\/\w+);base64,/);
          const mime = mimeMatch?.[1] || 'image/jpeg';
          return { type: 'image_url' as const, image_url: { url: b64.startsWith('data:') ? b64 : `data:${mime};base64,${b64}` } };
        } catch {
          return { type: 'image_url' as const, image_url: { url: img.url } };
        }
      })
    );

    // 5) GPT Vision structured analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: STRUCTURED_ANALYSIS_PROMPT },
        { role: 'user', content: [{ type: 'text', text: `Analyze these ${imageBlocks.length} reference image(s) and return the structured JSON.` }, ...imageBlocks] },
      ],
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const rawJson = response.choices[0].message.content || '{}';
    let analysisResult: LayoutAnalysisResult;
    try {
      analysisResult = JSON.parse(rawJson);
    } catch {
      return NextResponse.json({ error: 'GPT returned invalid JSON', raw: rawJson }, { status: 500 });
    }

    // 6) Save to DB
    const saved = await prisma.layoutAnalysis.create({
      data: {
        referenceId: id,
        rawAnalysisJson: analysisResult as any,
        designDnaJson: analysisResult.global_style as any,
        slideMapJson: analysisResult.slides as any,
      },
    });

    await prisma.reference.update({ where: { id }, data: { status: 'analyzed' } });

    // 7) Also update AnalysisCache for backward compat
    if (reference.sourceUrl) {
      const shortcode = reference.sourceUrl.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1] || reference.sourceUrl;
      await prisma.analysisCache.upsert({
        where: { shortcode },
        update: { structuredJson: analysisResult as any },
        create: {
          shortcode,
          instagramUrl: reference.sourceUrl,
          jsonlData: JSON.stringify(analysisResult),
          structuredJson: analysisResult as any,
        },
      }).catch(() => {}); // non-critical
    }

    return NextResponse.json({
      analysisId: saved.id,
      referenceId: id,
      designDna: analysisResult.global_style,
      slidePatterns: analysisResult.slides,
      summary: analysisResult.reference_summary,
      rules: analysisResult.template_rules,
    });

  } catch (error: any) {
    console.error('[references/[id]/analyze]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
