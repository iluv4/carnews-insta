import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept imageUrls (array) or legacy imageUrl (single)
    const imageUrls: string[] = body.imageUrls || (body.imageUrl ? [body.imageUrl] : []);

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('[analyze] API key present:', !!apiKey, '| images:', imageUrls.length);
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'dummy_key') {
      const dummyJsonl =
`{"type":"background", "color":"#1a1a1a", "style":"gradient"}
{"type":"title", "content":"카드뉴스 제목 예시", "color":"#ffffff", "position":"top-center", "fontSize":"large"}
{"type":"body", "content":"이곳에 본문 내용이 들어갑니다. 카드뉴스의 핵심 메시지를 분석하여 추출합니다.", "color":"#dddddd", "position":"center", "fontSize":"medium"}
{"type":"graphic_element", "description":"A glowing neon circle", "position":"bottom-right"}`;

      await new Promise(resolve => setTimeout(resolve, 2000));
      return NextResponse.json({ analysis: dummyJsonl });
    }

    // Convert any raw URLs to base64; already-base64 strings pass through
    const toBase64 = async (url: string): Promise<string> => {
      if (url.startsWith('data:')) return url;
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.statusText}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      return `data:${imgRes.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
    };

    let base64Images: string[];
    try {
      base64Images = await Promise.all(imageUrls.slice(0, 5).map(toBase64));
    } catch (fetchError: any) {
      console.error("Image Fetch Error:", fetchError);
      return NextResponse.json({ error: `Error while downloading image: ${fetchError.message}` }, { status: 400 });
    }

    const imageBlocks = base64Images.map(img => ({
      type: "image_url" as const,
      image_url: { url: img },
    }));

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are a professional Senior UI/UX Designer and Design Analyst. Your task is to deconstruct card news images into fundamental 'Design DNA' tokens."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these ${base64Images.length} reference image(s) together for style imitation. Synthesize a unified Design DNA from all images.
              Extract:
              1. Background: Exact HEX colors, textures (grain, glassmorphism, gradient), and lighting.
              2. Typography: Font mood (modern, serif, bold), alignment, and text-shadow rules.
              3. Layout: Structural logic (centered, asymmetrical, top-heavy) and white space utilization.
              4. Graphic Elements: Shadows, borders, shapes, and icon styles.
              5. Mood: 3-5 keywords describing the professional aesthetic.
              6. People/Subject: Describe the visual subject matter, poses, framing.

              OUTPUT: Strictly JSONL format (one JSON object per line). No markdown.
              Example:
              {"type":"background_dna", "primary_color":"#FFFFFF", "texture":"soft_gradient", "mood":"clean"}
              {"type":"typography_dna", "style":"sans-serif", "weight":"bold", "alignment":"center"}
              {"type":"layout_dna", "structure":"golden_ratio", "focus":"top"}
              {"type":"subject_dna", "description":"person facing camera, warm studio lighting, upper body shot"}
              `
            },
            ...imageBlocks,
          ],
        },
      ],
      max_tokens: 1200,
    });

    const analysis = visionResponse.choices[0].message.content;

    return NextResponse.json({ analysis });

  } catch (error: any) {
    const detail = error?.error?.message || error?.message || String(error);
    console.error('Error in OpenAI Analysis route:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
