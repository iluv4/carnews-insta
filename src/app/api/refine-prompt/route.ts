import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  buildPromptRefineMessages,
  resolvePersona,
  PERSONAS,
} from '@/lib/prompts';

// Takes the user's lazy one-liner + a chosen persona and returns a polished,
// concrete card-news topic. The refined string is meant to flow straight into
// the existing generation pipeline as `topic`, so this route stays thin: build
// messages → call the model → parse the JSON contract → return it.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// Surface the persona catalog so the client never hard-codes its own copy —
// prompts.ts stays the single source of truth.
export async function GET() {
  return NextResponse.json({ personas: PERSONAS });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, personaId } = (body ?? {}) as {
    prompt?: string;
    personaId?: string;
  };

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const persona = resolvePersona(personaId);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: buildPromptRefineMessages(prompt.trim(), persona) as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.5,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: { refined?: string; notes?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Model ignored the JSON contract — degrade gracefully to the raw text
      // rather than failing the whole request.
      parsed = { refined: raw.trim() };
    }

    const refined = (parsed.refined ?? '').trim();
    if (!refined) {
      return NextResponse.json(
        { error: 'Could not refine the prompt' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      refined,
      notes: parsed.notes ?? '',
      persona: { id: persona.id, label: persona.label, role: persona.role },
    });
  } catch (error) {
    console.error('Refine API Error:', error);
    return NextResponse.json({ error: 'Failed to refine prompt' }, { status: 500 });
  }
}
