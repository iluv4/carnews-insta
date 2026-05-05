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

    const dna = jsonlAnalysis.substring(0, 2000);

    const slides = [
      {
        role: 'COVER',
        layout: `LAYOUT (STRICT):
- TOP 20%: clean flat solid color band — headline text zone, completely flat with no texture
- MIDDLE 50%: dominant hero visual (abstract shape, texture, or atmospheric scene) — NO FACES, NO PEOPLE
- BOTTOM 30%: clean flat solid color band — subtitle zone, completely flat with no texture`,
      },
      {
        role: 'CONTENT',
        layout: `LAYOUT (STRICT):
- TOP 20%: clean flat solid header band — title text zone
- MIDDLE 60%: 2–3 visual info blocks or abstract icons in a grid — no people
- BOTTOM 20%: clean flat footer strip — CTA text zone`,
      },
      {
        role: 'CLOSING CTA',
        layout: `LAYOUT (STRICT):
- TOP 30%: clean flat dark band — closing headline zone
- MIDDLE 40%: single bold centered abstract graphic element
- BOTTOM 30%: clean flat brand-color band — CTA button zone`,
      },
    ];

    const responses = await Promise.all(
      slides.map(({ role, layout }) => {
        const prompt = `You are a world-class Korean card news (카드뉴스) designer.

TASK: Generate slide "${role}" for a card news series about: "${theme}"

DESIGN DNA — replicate this visual style EXACTLY:
${dna}

${layout}

RULES:
1. Portrait 2:3 format. Ultra-high visual quality.
2. NEVER render any letters, words, or text of any kind anywhere. Text zones must be left as clean flat color only.
3. No human faces or bodies. Use abstract, graphic, or product visuals only.
4. Colors, textures, and mood must precisely match the Design DNA.
5. Flat text zones are intentional — make them look polished and designed, not empty.`;

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

    return NextResponse.json({ transformedUrls });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Transform route error:', detail, error?.status);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
