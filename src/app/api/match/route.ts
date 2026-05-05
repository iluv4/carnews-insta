import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import prisma from '@/lib/prisma'; // Assuming we have access to prisma for fetching templates if needed

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { theme, templates } = await req.json();

    if (!theme) {
      return NextResponse.json({ error: 'Theme is required' }, { status: 400 });
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ error: 'Templates are required for matching' }, { status: 400 });
    }

    // Build a prompt that describes the available templates and asks GPT to pick the best match
    const templateDescriptions = templates.map((t: any) => `- ID: ${t.id}, Name: ${t.name}`).join('\n');

    const prompt = `
You are a design assistant. The user wants to create an Instagram card news post about the following theme:
"${theme}"

Here are the available design templates:
${templateDescriptions}

Based on the theme, select the single best template ID that matches the context. 
If the theme is about tech/IT, prefer tech-related templates. 
If it is about lifestyle, prefer lifestyle templates. 
Return ONLY the exact template ID string, nothing else.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that only outputs exact IDs without formatting or extra text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Low temperature for deterministic output
    });

    const bestTemplateId = response.choices[0].message.content?.trim();

    return NextResponse.json({ templateId: bestTemplateId });
  } catch (error: any) {
    console.error('Match API Error:', error);
    return NextResponse.json({ error: 'Failed to match template' }, { status: 500 });
  }
}
