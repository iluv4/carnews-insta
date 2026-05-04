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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      console.warn('No valid OPENAI_API_KEY found. Returning a simulated generated image.');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return NextResponse.json({ 
        transformedUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
        warning: 'Simulated response. Please add a valid OPENAI_API_KEY.'
      });
    }

    // 1. Analyze the original image using GPT-4o (Vision)
    let imageAnalysis = "An Instagram post image.";
    if (imageUrl) {
      try {
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe the core subject, colors, and mood of this image briefly in one sentence so it can be used as a prompt." },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          max_tokens: 100,
        });
        imageAnalysis = visionResponse.choices[0].message.content || imageAnalysis;
      } catch (visionError) {
        console.error("GPT-4V Error:", visionError);
        // Continue even if vision fails
      }
    }

    // 2. Blend description into GPT-Image-2 prompt
    const prompt = `Create a high-quality vertical background image for a social media card news post. 
    Original Image Context: ${imageAnalysis}
    Theme: ${theme}. 
    Aesthetic Style: ${reference}. 
    The image should be visually striking, modern, and leave negative space for text overlay. Do not include actual text.`;

    // 3. Generate image with GPT-Image-2
    const response = await openai.images.generate({
      model: "gpt-image-2",
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
