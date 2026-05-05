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

    // 2. Build premium prompts for a 3-slide carousel
    const premiumKeywords = "professional photography, high-end magazine style, minimalist SaaS aesthetic, clean composition, studio lighting, 8k resolution, elegant, sophisticated";
    const basePrompt = `Create a visually stunning, premium Instagram card news image. 
    Aesthetic Style: ${reference || 'modern and sleek'}. 
    Theme: ${theme}.
    Structural Context: ${jsonlAnalysis}.
    Keywords: ${premiumKeywords}.
    IMPORTANT: Leave clear, empty spaces for text overlays. No text in the image itself.`;
    
    const prompts = [
      `${basePrompt} This is Slide 1 (Cover). Focus on a striking main visual for the theme: ${theme}`,
      `${basePrompt} This is Slide 2 (Body Content). Focus on a balanced layout for the theme: ${theme}`,
      `${basePrompt} This is Slide 3 (Conclusion). Focus on a simple layout with a call to action for: ${theme}`
    ];

    // 3. Generate images with fallback: try gpt-image-2 first, fallback to dall-e-3 if needed
    let responses;
    try {
      // Try GPT Image-2
      responses = await Promise.all(
        prompts.map(prompt =>
          openai.images.generate({
            model: "gpt-image-2",
            prompt,
            n: 1,
            size: "1024x1792",
            quality: "hd",
          })
        )
      );
    } catch (gptError: any) {
      console.warn("GPT Image-2 failed, falling back to DALL·E 3:", gptError.message);
      // Fallback to DALL·E 3
      responses = await Promise.all(
        prompts.map(prompt =>
          openai.images.generate({
            model: "dall-e-3",
            prompt,
            n: 1,
            size: "1024x1792",
            quality: "hd",
          })
        )
      );
    }

    const transformedUrls = responses.map(res => res.data?.[0]?.url).filter(Boolean);

    if (transformedUrls.length === 0) {
      throw new Error('No image URLs returned from OpenAI');
    }

    return NextResponse.json({ transformedUrls });

  } catch (error: any) {
    console.error('Error in OpenAI API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
