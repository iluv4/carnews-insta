import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { jsonlAnalysis, theme } = await req.json();

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

    // Step 2: gpt-image-2 generates complete card news with text baked in
    const slides = [
      {
        role: 'COVER',
        text: `제목: "${copy.cover?.title}"\n부제: "${copy.cover?.subtitle}"`,
        layout: `Layout: Bold title text at top center, subtitle below it, strong hero visual filling the bottom half.`,
      },
      {
        role: 'CONTENT',
        text: `제목: "${copy.content?.title}"\n포인트:\n${(copy.content?.points || []).map((p: string) => `• ${p}`).join('\n')}`,
        layout: `Layout: Title at top, three bullet points with icons in the middle, clean footer at bottom.`,
      },
      {
        role: 'CLOSING CTA',
        text: `헤드라인: "${copy.closing?.headline}"\nCTA: "${copy.closing?.cta}"`,
        layout: `Layout: Large headline text centered, strong graphic below, CTA button at the bottom.`,
      },
    ];

    const responses = await Promise.all(
      slides.map(({ role, text, layout }) => {
        const prompt = `You are a world-class Korean card news (카드뉴스) designer and typographer.

Generate a COMPLETE, PRINT-READY "${role}" slide card news image for Instagram.

TOPIC: ${theme}

KOREAN TEXT TO RENDER IN THE IMAGE (render these exactly as written in Korean):
${text}

DESIGN DNA (match this style precisely):
${dna}

${layout}

TYPOGRAPHY RULES:
- Render all Korean text exactly as provided — clean, bold, highly legible
- Use a modern sans-serif style for Korean characters
- Text must be sharp and perfectly readable
- Title text: large and dominant
- Body/subtitle: medium weight, comfortable reading size

DESIGN RULES:
- Portrait format (2:3). Ultra-high visual quality.
- Colors, textures, mood must precisely match the Design DNA
- Professional Instagram card news aesthetic
- No additional random text or English except what is specified above`;

        return openai.images.generate({
          model: 'gpt-image-2',
          prompt,
          n: 1,
          size: '1024x1536',
          quality: 'high',
        } as any);
      })
    );

    const transformedUrls = responses.map((res) => {
      const item = res.data?.[0] as any;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error('gpt-image-2 응답이 비어 있습니다.');
    });

    return NextResponse.json({ transformedUrls, copy });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Transform route error:', detail, error?.status);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
