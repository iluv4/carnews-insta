import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client (requires OPENAI_API_KEY in environment)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { jsonlAnalysis, theme, reference } = await req.json();

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'JSONL Analysis data is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      console.warn('No valid OPENAI_API_KEY found. Returning a simulated generated image.');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return NextResponse.json({ 
        transformedUrls: [
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop'
        ],
        warning: 'Simulated response. Please add a valid OPENAI_API_KEY.'
      });
    }

    // 2. Build precision prompts based on Design DNA
    const trimmedAnalysis = jsonlAnalysis.substring(0, 3000); 
    
    const basePrompt = `You are a world-class Graphic Designer and Art Director. 
    TASK: Generate a high-end, professional Instagram card news background by PERFECTLY IMITATING the following Design DNA.
    ---
    DESIGN DNA (STRICT ADHERENCE REQUIRED):
    ${trimmedAnalysis}
    ---
    THEME TO APPLY: ${theme}
    AESTHETIC TARGET: ${reference || 'Premium SaaS, High-end Magazine, Minimalist Tech'}
    
    CRITICAL STYLE GUIDELINES:
    1. EXTREME QUALITY: The result must be a magazine-quality, studio-lit, ultra-high-resolution (8K) professional image.
    2. VIVID & PROFESSIONAL: Use advanced lighting (rim lighting, volumetric fog, ray tracing) and deep color depth.
    3. TEXT SAFETY: Leave intentional, high-quality negative space for text. NEVER generate any letters, characters, or text in the image.
    4. DESIGN DNA SYNERGY: Replicate the gradients, grain textures, and structural balance found in the DNA exactly.
    5. PHOTOREALISM: If the theme involves objects or cars, use hyper-realistic rendering like Octane Render or Unreal Engine 5 aesthetic.
    `;
    
    const prompts = [
      `${basePrompt} Focus: Strike Slide (Cover). Most visually impactful shot for theme: ${theme}`,
      `${basePrompt} Focus: Content Slide (Body). Balanced and clean layout for info about: ${theme}`,
      `${basePrompt} Focus: Action Slide (Conclusion). Minimalist and strong visual anchor for: ${theme}`
    ];

    // 3. Generate images — try gpt-image-2, fall back to dall-e-3
    async function generateOne(prompt: string): Promise<string> {
      // Try gpt-image-2 first
      try {
        const res = await openai.images.generate({
          model: "gpt-image-2",
          prompt,
          n: 1,
          size: "1024x1536",
          quality: "high",
        } as any);
        const item = res.data?.[0] as any;
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return item.url;
        throw new Error('Empty response from gpt-image-2');
      } catch (e: any) {
        console.warn('gpt-image-2 failed, falling back to dall-e-3:', e?.error?.message || e?.message);
      }

      // Fallback: dall-e-3 (universally available)
      const res = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.substring(0, 4000),
        n: 1,
        size: "1024x1792",
        quality: "hd",
        response_format: "b64_json",
      });
      const item = res.data?.[0] as any;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error('Empty response from dall-e-3');
    }

    const transformedUrls = await Promise.all(prompts.map(generateOne));

    return NextResponse.json({ transformedUrls });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Transform route error:', detail, error?.status, error?.error);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
