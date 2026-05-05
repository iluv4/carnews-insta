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

    const templateBase = `
TEMPLATE REMAKE INSTRUCTIONS:
Treat the reference image as a fixed template. Your job is to swap out only 3 things while keeping everything else pixel-perfect identical:
① FOOD/PRODUCT PHOTO → replace with high-quality photo of: "${theme}"
② BACKGROUND → replace with a background that fits "${theme}" (same style/mood as original)
③ TEXT CONTENT → replace with Korean copy appropriate for "${theme}"

KEEP EXACTLY (do not change):
- Overall card layout and grid structure
- Text box positions, sizes, and alignment
- Typography weight, size hierarchy, and font style
- Color scheme and palette (unless background swap requires adjustment)
- Overlay layers, gradients, borders, shadows
- Decorative graphic elements and icons
- Logo/badge placement areas
- Spacing and padding rhythm

Design DNA for reference:
${trimmedAnalysis}
`;

    const slidePrompts = [
      `${templateBase}\nSLIDE TYPE: COVER (slide 1 of 3). Strong hero image of "${theme}", bold title text at top or bottom.`,
      `${templateBase}\nSLIDE TYPE: CONTENT (slide 2 of 3). Feature/detail shot of "${theme}", body text with key points visible.`,
      `${templateBase}\nSLIDE TYPE: CLOSING CTA (slide 3 of 3). Atmospheric shot of "${theme}", closing headline and call-to-action button area.`,
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
          quality: 'low',
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
        quality: 'low',
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
