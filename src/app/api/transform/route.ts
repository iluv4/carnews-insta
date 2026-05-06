import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createJob, updateJobSlide } from '@/lib/jobStore';

export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { jsonlAnalysis, theme, reference, referenceImageBase64, jobId, clientContext, slideCount = 3 } = await req.json();
    if (jobId) createJob(jobId, slideCount, theme || '');

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'JSONL Analysis data is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      // Simulate SSE streaming for dev mode
      const encoder = new TextEncoder();
      const mockUrls = [
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
      ];
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 1; i++) {
            await new Promise(r => setTimeout(r, 800));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index: i, url: mockUrls[i] })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    const trimmedAnalysis = jsonlAnalysis.substring(0, 4000);

    // Extract brand mood only — never render operational details (address, phone, hours) as image text
    const brandMoodBlock = clientContext
      ? `\n[BRAND TONE — for mood/style reference only, DO NOT render as text in image]\n${
          clientContext
            .split('\n')
            .filter(l => !/전화|영업시간|휴무|위치|주소|서울|02-|@|http|\d{2}:\d{2}/.test(l))
            .join('\n')
            .trim()
        }\n`
      : '';

    const styleInstructions = `
[DESIGN RULES — FOLLOW EXACTLY]
Replicate every visual detail from the DNA: exact colors, font weights, layout grid, spacing, overlays, border-radius, shadows.
Only substitute: ① main subject/photo → "${theme}" ② background mood → "${theme}" atmosphere ③ all text → Korean for "${theme}".
CRITICAL: Render ONLY the headline message in the image. NO address, NO phone numbers, NO operating hours, NO URLs.
Minimal text = maximum impact. 1–2 lines of bold Korean copy only.
${brandMoodBlock}
[DESIGN DNA]
${trimmedAnalysis}`.trim();

    const slidePrompts = slideCount === 6 ? [
      `SLIDE 1 of 6 — COVER: Close-up hero shot of "${theme}". Bold Korean headline (max 2 lines): "부암동 소소한풍경 방문 전 체크!" Subtitle: "가격·시간·팁 한눈에". NO address, NO phone, NO hours — headline only. ${styleInstructions}`,
      `SLIDE 2 of 6 — 운영시간: Show operating hours as clean info graphic. 화~토 11:30~22:00 / 일 11:30~21:30 / 월 정기휴무 / 브레이크타임 15:30~17:00. Theme: "${theme}". ${styleInstructions}`,
      `SLIDE 3 of 6 — 코스 가격표: Display course menu prices clearly. A코스 28,000원 / B코스 42,000원 / C코스 58,000원 / Special 120,000원. Theme: "${theme}". ${styleInstructions}`,
      `SLIDE 4 of 6 — 단품 가격표: Display à la carte prices. 가지찜 30,000 / 건두부쌈 22,000 / 오징어먹물볶음밥 16,000 / 하우스샐러드 14,000 / 버팔로윙 16,000. Theme: "${theme}". ${styleInstructions}`,
      `SLIDE 5 of 6 — 방문 팁: Tip list card. ① 브레이크타임(15:30~17:00) 피하기 ② 월요일 정기휴무 확인 ③ 사전 예약 권장 ④ 전화 02-395-5035. Theme: "${theme}". ${styleInstructions}`,
      `SLIDE 6 of 6 — CTA: Closing card. "부암동 데이트·가족 식사 전 저장!" / "예약 전 운영시간 꼭 확인". Small disclaimer: "2026년 5월 기준 / 방문 전 매장 확인 권장". Theme: "${theme}". ${styleInstructions}`,
    ] : [
      `COVER: Close-up hero shot of "${theme}". One bold Korean headline (max 2 lines) that stops the scroll. NO address, NO phone, NO hours — headline only. ${styleInstructions}`,
      `CONTENT slide: detail/feature shot of "${theme}", Korean body text with key points. ${styleInstructions}`,
      `CLOSING CTA slide: atmospheric "${theme}" shot, Korean closing headline + CTA. ${styleInstructions}`,
    ];

    async function generateSlide(slidePrompt: string): Promise<string> {
      if (referenceImageBase64) {
        const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const mimeMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = (mimeMatch?.[1] || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageFile = new File([imageBuffer], 'reference.png', { type: mimeType });

        const res = await (openai.images as any).edit({
          model: 'gpt-image-2',
          image: imageFile,
          prompt: slidePrompt.substring(0, 32000),
          n: 1,
          size: '1024x1024',
          quality: 'high',
        });

        const item = res.data?.[0] as any;
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return item.url;
        throw new Error('gpt-image-2 edit 응답이 비어 있습니다.');
      }

      const res = await openai.images.generate({
        model: 'gpt-image-2',
        prompt: slidePrompt.substring(0, 32000),
        n: 1,
        size: '1024x1536',
        quality: 'high',
      } as any);

      const item = res.data?.[0] as any;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error('gpt-image-2 generate 응답이 비어 있습니다.');
    }

    // SSE stream — send each slide as soon as it's ready
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        await Promise.allSettled(
          slidePrompts.map(async (prompt, i) => {
            try {
              const url = await generateSlide(prompt);
              if (jobId) updateJobSlide(jobId, i, { url });
              send({ index: i, url });
            } catch (e: any) {
              if (jobId) updateJobSlide(jobId, i, { error: e.message });
              send({ index: i, error: e.message });
            }
          })
        );

        send({ done: true });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Transform route error:', detail, error?.status);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
