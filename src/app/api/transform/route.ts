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
        text: `제목: "${copy.cover?.title}" / 부제: "${copy.cover?.subtitle}"`,
        instruction: `Keep all people, faces, backgrounds, and visual elements from the reference image exactly as they appear.
Redesign it as a professional Instagram card news COVER slide:
- Add a semi-transparent dark gradient overlay at the top for text readability
- Render the Korean title "${copy.cover?.title}" in large bold text at the top
- Render the Korean subtitle "${copy.cover?.subtitle}" in smaller text below the title
- Maintain the original image composition, people, and atmosphere underneath`,
      },
      {
        role: 'CONTENT',
        text: `제목: "${copy.content?.title}" / 포인트: ${(copy.content?.points || []).join(', ')}`,
        instruction: `Keep all people, faces, backgrounds, and visual elements from the reference image.
Redesign it as a professional Instagram card news CONTENT slide:
- Add a semi-transparent overlay panel on one side or top for text
- Render the Korean title "${copy.content?.title}" prominently
- Render these Korean bullet points clearly: ${(copy.content?.points || []).map((p: string) => `• ${p}`).join(' / ')}
- Maintain the original image people and atmosphere`,
      },
      {
        role: 'CLOSING CTA',
        text: `헤드라인: "${copy.closing?.headline}" / CTA: "${copy.closing?.cta}"`,
        instruction: `Keep all people, faces, backgrounds, and visual elements from the reference image.
Redesign it as a professional Instagram card news CLOSING slide:
- Add a bold overlay at bottom for CTA
- Render the Korean headline "${copy.closing?.headline}" in large centered text
- Render the CTA "${copy.closing?.cta}" as a button-style element at the bottom
- Maintain the original image people and atmosphere`,
      },
    ];

    async function generateSlide(slide: typeof slides[0]): Promise<string> {
      const prompt = `You are a world-class Korean card news (카드뉴스) designer.

TOPIC: "${theme}"

${slide.instruction}

DESIGN DNA (apply this color palette and style on top):
${dna}

TYPOGRAPHY: All Korean text must be sharp, bold, and perfectly legible. Modern sans-serif style.
FORMAT: Portrait 2:3, ultra-high quality, professional Instagram aesthetic.`;

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
