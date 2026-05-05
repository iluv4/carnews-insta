import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  const { jsonlAnalysis, theme, referenceImageBase64 } = await req.json();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
    return new Response(
      [0, 1, 2].map(i => `data: ${JSON.stringify({ index: i, url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600' })}\n\n`).join(''),
      { headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const dna = (jsonlAnalysis || '').substring(0, 1500);

  // Step 1: GPT-4.1 writes Korean copy
  let copy: any = {};
  try {
    const copyRes = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: '너는 인스타그램 카드뉴스 카피라이터야. 임팩트 있고 짧은 한국어 카피를 작성해. JSON으로만 응답해.' },
        { role: 'user', content: `주제: "${theme}"\n\n슬라이드 3장 카피를 작성해:\n{\n  "cover": { "title": "훅 문구 (15자 이내)", "subtitle": "부제 (20자 이내)" },\n  "content": { "title": "본문 제목 (15자 이내)", "points": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"] },\n  "closing": { "headline": "마무리 문구 (15자 이내)", "cta": "CTA 버튼 문구 (10자 이내)" }\n}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    });
    copy = JSON.parse(copyRes.choices[0].message.content || '{}');
  } catch (e) {
    console.error('Copy generation error:', e);
  }

  const slides = [
    {
      role: 'COVER',
      instruction: `Keep all people, faces, and backgrounds from the reference image.
Redesign as a professional Instagram card news COVER slide:
- Add a semi-transparent dark gradient overlay at top for text readability
- Render Korean title "${copy.cover?.title || theme}" in large bold text at top
- Render Korean subtitle "${copy.cover?.subtitle || ''}" below the title
- Maintain the original image composition underneath`,
    },
    {
      role: 'CONTENT',
      instruction: `Keep all people, faces, and backgrounds from the reference image.
Redesign as a professional Instagram card news CONTENT slide:
- Add overlay panel for text
- Render Korean title "${copy.content?.title || theme}" prominently
- Render bullet points: ${(copy.content?.points || []).map((p: string) => `• ${p}`).join(' / ')}
- Maintain original image people and atmosphere`,
    },
    {
      role: 'CLOSING CTA',
      instruction: `Keep all people, faces, and backgrounds from the reference image.
Redesign as a professional Instagram card news CLOSING slide:
- Render Korean headline "${copy.closing?.headline || theme}" in large centered text
- Render CTA "${copy.closing?.cta || '지금 시작하기'}" as a button at the bottom
- Maintain original image people and atmosphere`,
    },
  ];

  async function generateSlide(slide: typeof slides[0]): Promise<string> {
    const prompt = `You are a world-class Korean card news (카드뉴스) designer.
TOPIC: "${theme}"
${slide.instruction}
DESIGN DNA: ${dna}
TYPOGRAPHY: All Korean text must be sharp, bold, highly legible. Modern sans-serif.
FORMAT: Portrait 2:3, ultra-high quality, professional Instagram aesthetic.`;

    if (referenceImageBase64) {
      const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,/);
      const mimeType = (mimeMatch?.[1] || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
      const imageFile = new File([Buffer.from(base64Data, 'base64')], 'reference.png', { type: mimeType });

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
    throw new Error('Empty response');
  }

  // SSE stream — all 3 slides generate in parallel, emit each as soon as ready
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await Promise.all(
        slides.map(async (slide, i) => {
          try {
            const url = await generateSlide(slide);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index: i, url })}\n\n`));
          } catch (e: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index: i, error: e.message })}\n\n`));
          }
        })
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
