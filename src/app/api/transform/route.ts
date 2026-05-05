import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createJob, updateJobSlide } from '@/lib/jobStore';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { jsonlAnalysis, theme, reference, referenceImageBase64, jobId } = await req.json();
    if (jobId) createJob(jobId, 3, theme || '');

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
        warning: 'Simulated response. Please add a valid OPENAI_API_KEY.',
      });
    }

    const trimmedAnalysis = jsonlAnalysis.substring(0, 2000);

    const slidePrompts = [
      `This is a cover slide. Apply theme: "${theme}". Use the same visual style, color palette, layout structure as the reference. Leave clean space for large title text. No text in the image.`,
      `This is a content slide. Apply theme: "${theme}". Balanced layout with the same brand aesthetic as the reference. Leave space for body text. No text in the image.`,
      `This is a closing slide. Apply theme: "${theme}". Minimalist, strong visual anchor matching the reference style. Leave space for CTA text. No text in the image.`,
    ];

    async function generateSlide(slidePrompt: string): Promise<string> {
      // Use images.edit when reference image is available — feeds actual image style directly
      if (referenceImageBase64) {
        const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const mimeMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = (mimeMatch?.[1] || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageFile = new File([imageBuffer], 'reference.png', { type: mimeType });

        const fullPrompt = `Redesign this Instagram card news image for a new topic while keeping the EXACT same visual style, color scheme, typography mood, and layout structure from the reference image.\n\nDesign DNA reference:\n${trimmedAnalysis}\n\n${slidePrompt}`;

        const res = await (openai.images as any).edit({
          model: 'gpt-image-2',
          image: imageFile,
          prompt: fullPrompt.substring(0, 32000),
          n: 1,
          size: '1024x1536',
          quality: 'high',
        });

        const item = res.data?.[0] as any;
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return item.url;
        throw new Error('gpt-image-2 edit 응답이 비어 있습니다.');
      }

      // Fallback: generate without reference image
      const fullPrompt = `Professional Instagram card news image. Design DNA:\n${trimmedAnalysis}\n\n${slidePrompt}`;
      const res = await openai.images.generate({
        model: 'gpt-image-2',
        prompt: fullPrompt.substring(0, 32000),
        n: 1,
        size: '1024x1536',
        quality: 'high',
      } as any);

      const item = res.data?.[0] as any;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error('gpt-image-2 generate 응답이 비어 있습니다.');
    }

    const transformedUrls = await Promise.all(
      slidePrompts.map(async (prompt, i) => {
        try {
          const url = await generateSlide(prompt);
          if (jobId) updateJobSlide(jobId, i, { url });
          return url;
        } catch (e: any) {
          if (jobId) updateJobSlide(jobId, i, { error: e.message });
          throw e;
        }
      })
    );

    return NextResponse.json({ transformedUrls });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Transform route error:', detail, error?.status);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
