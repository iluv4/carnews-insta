import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      const dummyJsonl = 
`{"type":"background", "color":"#1a1a1a", "style":"gradient"}
{"type":"title", "content":"카드뉴스 제목 예시", "color":"#ffffff", "position":"top-center", "fontSize":"large"}
{"type":"body", "content":"이곳에 본문 내용이 들어갑니다. 카드뉴스의 핵심 메시지를 분석하여 추출합니다.", "color":"#dddddd", "position":"center", "fontSize":"medium"}
{"type":"graphic_element", "description":"A glowing neon circle", "position":"bottom-right"}`;
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      return NextResponse.json({ analysis: dummyJsonl });
    }

    // Fetch image and convert to base64 to bypass OpenAI download errors
    let base64Image;
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed to fetch image for analysis: ${imgRes.statusText}`);
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Image = `data:${imgRes.headers.get('content-type') || 'image/jpeg'};base64,${buffer.toString('base64')}`;
    } catch (fetchError: any) {
      console.error("Image Fetch Error:", fetchError);
      return NextResponse.json({ error: `Error while downloading image: ${fetchError.message}` }, { status: 400 });
    }

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content: "You are a professional Senior UI/UX Designer and Design Analyst. Your task is to deconstruct a card news image into its fundamental 'Design DNA' tokens."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Analyze this reference image in extreme detail for style imitation. 
              Extract the following Design DNA tokens:
              1. Background: Exact HEX colors, textures (grain, glassmorphism, gradient), and lighting.
              2. Typography: Font mood (modern, serif, bold), alignment, and text-shadow rules.
              3. Layout: Structural logic (centered, asymmetrical, top-heavy) and white space utilization.
              4. Graphic Elements: Shadows, borders, shapes, and icon styles.
              5. Mood: 3-5 keywords describing the professional aesthetic.

              OUTPUT: Strictly JSONL format (one JSON object per line). No markdown. 
              Example:
              {"type":"background_dna", "primary_color":"#FFFFFF", "texture":"soft_gradient", "mood":"clean"}
              {"type":"typography_dna", "style":"sans-serif", "weight":"bold", "alignment":"center"}
              {"type":"layout_dna", "structure":"golden_ratio", "focus":"top"}
              `
            },
            {
              type: "image_url",
              image_url: { url: base64Image },
            },
          ],
        },
      ],
      max_completion_tokens: 1000,
    });

    const analysis = visionResponse.choices[0].message.content;

    return NextResponse.json({ analysis });

  } catch (error: any) {
    console.error('Error in OpenAI Analysis route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
