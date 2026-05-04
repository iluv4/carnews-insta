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
      // Return simulated JSONL data for preview
      const dummyJsonl = 
`{"type":"background", "color":"#1a1a1a", "style":"gradient"}
{"type":"title", "content":"카드뉴스 제목 예시", "color":"#ffffff", "position":"top-center", "fontSize":"large"}
{"type":"body", "content":"이곳에 본문 내용이 들어갑니다. 카드뉴스의 핵심 메시지를 분석하여 추출합니다.", "color":"#dddddd", "position":"center", "fontSize":"medium"}
{"type":"graphic_element", "description":"A glowing neon circle", "position":"bottom-right"}`;
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      return NextResponse.json({ analysis: dummyJsonl });
    }

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this card news image in detail. Extract the background aesthetic, color palette, layout structure, and all text content. Output the result STRICTLY in JSONL format (one JSON object per line). Do not include any markdown formatting like ```jsonl. Example keys: type (background/title/body/graphic), content, color, position." 
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const analysis = visionResponse.choices[0].message.content;

    return NextResponse.json({ analysis });

  } catch (error: any) {
    console.error('Error in OpenAI Analysis route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
