import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client (requires OPENAI_API_KEY in environment)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { imageUrl, theme, reference } = await req.json();

    if (!theme) {
      return NextResponse.json({ error: 'Theme is required' }, { status: 400 });
    }

    // Since we are using DALL-E 3, direct image-to-image is not supported with a prompt.
    // Instead, we use text-to-image with a highly descriptive prompt incorporating the theme and reference style.
    // In a full production app, you might first pass the `imageUrl` to GPT-4V to get a text description, 
    // and then blend that description with the theme for the DALL-E 3 prompt.
    
    const prompt = `Create a high-quality vertical background image for a social media card news post. 
    Theme: ${theme}. 
    Aesthetic Style: ${reference}. 
    The image should be visually striking, modern, and leave some negative space for text overlay. Do not include actual text.`;

    // Check if we have a real API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('No OPENAI_API_KEY found. Returning a simulated generated image.');
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      return NextResponse.json({ 
        transformedUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
        warning: 'Simulated response. Please add OPENAI_API_KEY.'
      });
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1792", // Vertical aspect ratio for card news
      quality: "standard",
    });

    const transformedUrl = response.data[0].url;

    return NextResponse.json({ transformedUrl });

  } catch (error: any) {
    console.error('Error in OpenAI API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
