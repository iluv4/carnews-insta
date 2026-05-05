import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { jsonlAnalysis, theme, referenceImageBase64 } = await req.json();

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'JSONL Analysis data is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return NextResponse.json({
        transformedUrls: [
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop',
        ],
        warning: 'Simulated response.',
      });
    }

    const dna = jsonlAnalysis.substring(0, 1500);

    // Step 1: GPT-4o writes Korean card news copy
    const copyRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '너는 인스타그램 카드뉴스 카피라이터야. 임팩트 있고 짧은 한국어 카피를 작성해. JSON으로만 응답해.',
        },
        {
          role: 'user',
          content: `주제: "${theme}"\n\n슬라이드 3장 카피를 작성해:\n{\n  "cover": { "title": "훅 문구 (15자 이내)", "subtitle": "부제 (20자 이내)" },\n  "content": { "title": "본문 제목 (15자 이내)", "points": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"] },\n  "closing": { "headline": "마무리 문구 (15자 이내)", "cta": "CTA 버튼 문구 (10자 이내)" }\n}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    });

    const copy = JSON.parse(copyRes.choices[0].message.content || '{}');

    const slides = [
      {
        role: 'COVER',
        text: `제목: "${copy.cover?.title}"\n부제: "${copy.cover?.subtitle}"`,
        layout: 'Bold title at top center, subtitle below, strong hero visual at bottom half.',
      },
      {
        role: 'CONTENT',
        text: `제목: "${copy.content?.title}"\n${(copy.content?.points || []).map((p: string) => `• ${p}`).join('\n')}`,
        layout: 'Title at top, three bullet points with icons in the middle, clean footer.',
      },
      {
        role: 'CLOSING CTA',
        text: `헤드라인: "${copy.closing?.headline}"\nCTA: "${copy.closing?.cta}"`,
        layout: 'Large headline centered, bold graphic below, CTA button at bottom.',
      },
    ];

    // Step 2: Generate with reference image (images.edit) or text-only (images.generate)
    async function generateSlide(slide: typeof slides[0]): Promise<string> {
      const prompt = `You are a world-class Korean card news (카드뉴스) designer.

TASK: Create a BRAND NEW "${slide.role}" slide about: "${theme}"

⚠️ CRITICAL STYLE INSTRUCTION:
The reference image is provided ONLY as a visual style guide.
COMPLETELY DISCARD all content from the reference (people, faces, objects, text, backgrounds).
Extract and replicate ONLY: color palette, gradient style, texture, typography mood, layout rhythm, and overall aesthetic.
The output must be a 100% new original image — NOT a variation or edit of the reference.

KOREAN TEXT TO RENDER (exact characters, bold and legible):
${slide.text}

LAYOUT: ${slide.layout}

DESIGN DNA (from style analysis):
${dna}

RULES:
- Portrait 2:3 format. Ultra-high quality.
- Render Korean text exactly as provided — sharp, modern sans-serif, highly legible
- No human faces or bodies
- Replicate the color palette and visual mood from the reference precisely`;

      if (referenceImageBase64) {
        const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const mimeMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = (mimeMatch?.[1] || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageFile = new File([imageBuffer], 'reference.png', { type: mimeType });

        const res = await (openai.images as any).edit({
          model: 'gpt-image-2',
          image: imageFile,
          prompt,
          n: 1,
          size: '1024x1536',
          quality: 'high',
        });
        const item = res.data?.[0] as any;
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return item.url;
        throw new Error('Empty response from images.edit');
      }

      // Fallback: no reference image
      const res = await openai.images.generate({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1536',
        quality: 'high',
      } as any);
      const item = res.data?.[0] as any;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error('Empty response from images.generate');
    }

    const transformedUrls = await Promise.all(slides.map(generateSlide));

    return NextResponse.json({ transformedUrls, copy });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Transform route error:', detail, error?.status);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
