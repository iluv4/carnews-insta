import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createJob, updateJobSlide } from '@/lib/jobStore';

export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { jsonlAnalysis, theme, reference, referenceImageBase64, jobId, clientContext } = await req.json();
    if (jobId) createJob(jobId, 1, theme || '');

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'JSONL Analysis data is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      // Dev mode: simulate partial → final sequence
      const encoder = new TextEncoder();
      const mockUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop';
      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: object) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          await new Promise(r => setTimeout(r, 600));
          send({ index: 0, partial: true, blurLevel: 2, url: mockUrl });
          await new Promise(r => setTimeout(r, 600));
          send({ index: 0, partial: true, blurLevel: 1, url: mockUrl });
          await new Promise(r => setTimeout(r, 600));
          send({ index: 0, url: mockUrl });
          send({ done: true });
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    const trimmedAnalysis = jsonlAnalysis.substring(0, 4000);

    const operationalPattern = /전화|영업시간|휴무|위치|주소|서울|02-|@|http|\d{2}:\d{2}/;
    const brandMoodBlock = clientContext
      ? '\n[BRAND TONE — for mood/style reference only, DO NOT render as text in image]\n' +
        clientContext
          .split('\n')
          .filter((l: string) => !operationalPattern.test(l))
          .join('\n')
          .trim() +
        '\n'
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

    const slidePrompt = `COVER: Close-up hero shot of "${theme}". One bold Korean headline (max 2 lines) that stops the scroll. NO address, NO phone, NO hours — headline only. ${styleInstructions}`;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // Build input content
          const inputContent: any[] = [
            { type: 'input_text', text: slidePrompt.substring(0, 32000) },
          ];
          if (referenceImageBase64) {
            inputContent.push({ type: 'input_image', image_url: referenceImageBase64 });
          }

          const responseStream = await (openai as any).responses.create({
            model: 'gpt-4.1-mini',
            input: inputContent,
            tools: [{
              type: 'image_generation',
              size: '1024x1536',
              quality: 'medium',
              output_format: 'jpeg',
              partial_images: 2,
            }],
            stream: true,
          });

          let finalUrl = '';

          for await (const event of responseStream) {
            // Partial previews — show blurry versions
            if (event.type === 'response.image_generation_call.partial_image') {
              const b64 = event.partial_image_b64;
              const blurLevel = event.partial_image_index === 0 ? 2 : 1;
              if (b64) {
                send({ index: 0, partial: true, blurLevel, url: `data:image/jpeg;base64,${b64}` });
              }
            }

            // Final image in completed response
            if (event.type === 'response.completed') {
              const output: any[] = event.response?.output ?? [];
              for (const item of output) {
                if (item.type === 'image_generation_call' && item.result) {
                  finalUrl = `data:image/jpeg;base64,${item.result}`;
                }
              }
            }
          }

          if (!finalUrl) throw new Error('이미지 생성 결과가 없습니다.');

          if (jobId) updateJobSlide(jobId, 0, { url: finalUrl });
          send({ index: 0, url: finalUrl });

        } catch (e: any) {
          if (jobId) updateJobSlide(jobId, 0, { error: e.message });
          send({ index: 0, error: e.message });
        }

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
