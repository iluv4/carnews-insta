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
        transformedUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
        warning: 'Simulated response. Please add a valid OPENAI_API_KEY.'
      });
    }

    // 2. Blend JSONL analysis into GPT-Image-2 prompt
    const prompt = `Create a high-quality vertical background image for a social media card news post. 
    Imitate the layout and style described in this JSONL structure: 
    ${jsonlAnalysis}

    Additional Theme: ${theme || 'None'}. 
    Aesthetic Style: ${reference || 'modern'}. 
    The image should be visually striking, match the extracted structure, and leave negative space for text overlay. Do not include actual text.`;

    // 3. Generate image with dall-e-3 (using as fallback for gpt-image-2 verification issues)
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1792", // Vertical aspect ratio for card news
    });

    const transformedUrl = response.data?.[0]?.url;

    if (!transformedUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    return NextResponse.json({ transformedUrl });

  } catch (error: any) {
    console.error('Error in OpenAI API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
