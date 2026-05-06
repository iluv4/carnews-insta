import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createJob, updateJobSlide } from '@/lib/jobStore';

export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

function toImageFile(base64: string): File {
  const raw = base64.replace(/^data:image\/\w+;base64,/, '');
  const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
  const mime = (mimeMatch?.[1] || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
  return new File([Buffer.from(raw, 'base64')], 'image.png', { type: mime });
}

export async function POST(req: Request) {
  try {
    const {
      jsonlAnalysis,
      theme,
      styleTemplateBase64,   // 카드뉴스 레이아웃 템플릿 (styleReferenceUrl 포스트 이미지)
      referenceImageBase64,  // 클라이언트 실제 사진 (콘텐츠 소스)
      jobId,
      clientContext,
      slideCount = 3,
    } = await req.json();

    if (jobId) createJob(jobId, slideCount, theme || '');

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'JSONL Analysis data is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      const encoder = new TextEncoder();
      const mockUrls = [
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
      ];
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < slideCount; i++) {
            await new Promise(r => setTimeout(r, 800));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index: i, url: mockUrls[i % 3] })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    const trimmedAnalysis = jsonlAnalysis.substring(0, 1200);
    const clientContextBlock = clientContext ? `\n[업체 정보]\n${clientContext}` : '';

    // Extract brand mood only — never render operational details (address, phone, hours) as image text
    const brandMoodBlock = clientContext
      ? `
[BRAND TONE — for mood/style reference only, DO NOT render as text in image]
${
          clientContext
            .split('
')
            .filter((l: string) => !/전화|영업시간|휴무|위치|주소|서울|02-|@|http|\d{2}:\d{2}/.test(l))
            .join('
')
            .trim()
        }
`
      : '';

    // ── 레이아웃 고정 핵심 지시 ──────────────────────────────────────────
    const LAYOUT_LOCK = `
You are given TWO input images:
• IMAGE 1 = Korean Instagram card news LAYOUT TEMPLATE — this defines the exact layout to preserve
• IMAGE 2 = Client's actual food/product photo — this is the ONLY photo to place in the image area

RULES (non-negotiable):
① Copy IMAGE 1's layout EXACTLY: grid structure, text box positions, typography sizes/weights, color palette, borders, shadows, overlays, decorative elements — pixel-perfect
② Place IMAGE 2 into the image placeholder area of IMAGE 1 — do NOT use AI-generated food photos
③ Rewrite all Korean text copy for the new topic using the client info below
④ Do NOT generate new photos; do NOT hallucinate product images; only use IMAGE 2 as the photo source
⑤ CRITICAL: Render ONLY the specified text in image. NO address, NO phone numbers, NO operating hours unless this slide explicitly requires them.
${clientContextBlock}

Design DNA extracted from the template (secondary reference only — IMAGE 1 takes priority):
${trimmedAnalysis}
`.trim();

    // Fallback style instructions for non-template generation path
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
      `${LAYOUT_LOCK}

SLIDE 1/6 — COVER: Close-up hero shot of "${theme}". Bold Korean headline (max 2 lines): "부암동 소소한풍경 방문 전 체크!" Subtitle: "가격·시간·팁 한눈에". NO address, NO phone, NO hours — headline only.`,
      `${LAYOUT_LOCK}

SLIDE 2/6 — 운영시간: Keep layout exactly. Replace content with operating hours: 화~토 11:30~22:00 / 일 11:30~21:30 / 월 정기휴무 / 브레이크타임 15:30~17:00.`,
      `${LAYOUT_LOCK}

SLIDE 3/6 — 코스 가격표: Keep layout exactly. Replace content with course prices: A코스 28,000원 / B코스 42,000원 / C코스 58,000원 / Special 120,000원.`,
      `${LAYOUT_LOCK}

SLIDE 4/6 — 단품 가격표: Keep layout exactly. Replace content with à la carte: 가지찜 30,000원 / 건두부쌈 22,000원 / 오징어먹물볶음밥 16,000원 / 하우스샐러드 14,000원 / 버팔로윙 16,000원.`,
      `${LAYOUT_LOCK}

SLIDE 5/6 — 방문 팁: Keep layout exactly. Replace content with tips: ① 브레이크타임(15:30~17:00) 피하기 ② 월요일 정기휴무 확인 ③ 사전 예약 권장 ④ 전화 02-395-5035.`,
      `${LAYOUT_LOCK}

SLIDE 6/6 — CTA: Keep layout exactly. Replace content with: "부암동 데이트·가족 식사 전 저장!" and "예약 전 운영시간 꼭 확인". Add small disclaimer: "2026년 5월 기준 / 방문 전 매장 확인 권장".`,
    ] : [
      `COVER: Close-up hero shot of "${theme}". One bold Korean headline (max 2 lines) that stops the scroll. NO address, NO phone, NO hours — headline only. ${styleInstructions}`,
      `CONTENT slide: detail/feature shot of "${theme}", Korean body text with key points. ${styleInstructions}`,
      `CLOSING CTA slide: atmospheric "${theme}" shot, Korean closing headline + CTA. ${styleInstructions}`,
    ];

    async function generateSlide(slidePrompt: string): Promise<string> {
      // 두 이미지를 배열로 넘김:
      // images[0] = 카드뉴스 레이아웃 템플릿 (styleReferenceUrl 포스트) → 레이아웃/텍스트 구조 고정
      // images[1] = 클라이언트 실제 사진 (clientInstagramUrl) → 이미지 영역에만 배치
      if (styleTemplateBase64 && referenceImageBase64) {
        const res = await (openai.images as any).edit({
          model: 'gpt-image-2',
          image: [toImageFile(styleTemplateBase64), toImageFile(referenceImageBase64)],
          prompt: slidePrompt.substring(0, 32000),
          n: 1,
          size: '1024x1024',
          quality: 'high',
        });
        const item = res.data?.[0] as any;
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return item.url;
        throw new Error('gpt-image-2 edit(2-image) 응답이 비어 있습니다.');
      }

      // 템플릿만 있는 경우
      const templateB64 = styleTemplateBase64 || referenceImageBase64;
      if (templateB64) {
        const res = await (openai.images as any).edit({
          model: 'gpt-image-2',
          image: toImageFile(templateB64),
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

      // fallback: generate
      const res = await openai.images.generate({
        model: 'gpt-image-2',
        prompt: slidePrompt.substring(0, 32000),
        n: 1,
        size: '1024x1024',
        quality: 'high',
      } as any);
      const item = res.data?.[0] as any;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error('gpt-image-2 generate 응답이 비어 있습니다.');
    }

    // SSE — 슬라이드 완료될 때마다 즉시 전송
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
