import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  buildTemplateMatchMessages,
  resolveTemplateId,
  type MatchableTemplate,
} from '@/lib/prompts';
import { MODELS, chatTuning } from '@/lib/models';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function POST(req: Request) {
  try {
    const { theme, templates } = (await req.json()) as {
      theme?: string;
      templates?: MatchableTemplate[];
    };

    if (!theme) {
      return NextResponse.json({ error: 'Theme is required' }, { status: 400 });
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ error: 'Templates are required for matching' }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: MODELS.classify,
      messages: buildTemplateMatchMessages(theme, templates) as OpenAI.Chat.ChatCompletionMessageParam[],
      // Bare-id output; low reasoning effort keeps this classification cheap and
      // fast. The visible answer is tiny but reasoning models still need budget
      // headroom (a 32-token cap would be eaten by reasoning → empty reply).
      ...chatTuning(MODELS.classify, { maxOutputTokens: 32, temperature: 0.1, reasoningEffort: 'low' }),
    });

    // Guardrail: never trust the raw reply. Validate against the real id set so
    // a hallucinated or chatty answer can't leak through to the client.
    const templateId = resolveTemplateId(response.choices[0].message.content, templates);

    return NextResponse.json({ templateId });
  } catch (error) {
    console.error('Match API Error:', error);
    return NextResponse.json({ error: 'Failed to match template' }, { status: 500 });
  }
}
