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
    if (jobId) createJob(jobId, 3, theme || '');

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'JSONL Analysis data is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      // Simulate SSE streaming for dev mode
      const encoder = new TextEncoder();
      const mockUrls = [
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop',
      ];
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 3; i++) {
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

    // Compress analysis — keep under 1200 chars to reduce token overhead
    const trimmedAnalysis = jsonlAnalysis.substring(0, 1200);

    const clientContextBlock = clientContext
      ? `CLIENT CONTEXT: ${clientContext}\n`
      : '';

    // Concise base prompt — verbose repetition removed
    const styleInstructions = `Keep layout, typography, colors, overlays, spacing IDENTICAL to reference. Only change: ① food photo → "${theme}" ② background to match "${theme}" mood ③ text copy to Korean for "${theme}". ${clientContextBlock}DNA: ${trimmedAnalysis}`;

    const slidePrompts = [
      `COVER slide: hero image of "${theme}", bold Korean title. ${styleInstructions}`,
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
          quality: 'low',
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
        size: '1024x1024',
        quality: 'low',
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
