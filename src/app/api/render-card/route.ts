import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { parseDNA, buildCardLayerDocument } from '@/lib/layerBuilder';
import { generateLayerDocument } from '@/lib/layerGenerator';
import { layerDocumentToHtml } from '@/lib/layerRenderer';
import { validateLayerDocument, CANVAS_W, CANVAS_H } from '@/lib/layerSchema';
import { htmlToImage } from '@/lib/puppeteerShot';
import { generateBackground } from '@/lib/backgroundGen';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

// ── Generate Korean card copy via gpt-4.1-mini ────────────────────────────────
async function generateCopy(theme: string, clientContext: string): Promise<{
  headline: string;
  subheadline: string;
  badge: string;
}> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `당신은 한국 인스타그램 카드뉴스 카피라이터입니다.
다음 주제로 임팩트 있는 카드뉴스 카피를 작성하세요.

주제: ${theme}
${clientContext ? `업체 정보:\n${clientContext}` : ''}

JSON으로만 응답:
{
  "headline": "스크롤을 멈추게 하는 굵은 한국어 헤드라인 (최대 12자, 줄바꿈 없음)",
  "subheadline": "헤드라인 보조 문구 (최대 20자)",
  "badge": "우측 상단 뱃지 텍스트 (최대 6자, 예: 신메뉴, 이벤트, 추천)"
}`,
    }],
    max_tokens: 200,
  });
  try {
    return JSON.parse(res.choices[0].message.content ?? '{}');
  } catch {
    return { headline: theme, subheadline: '지금 바로 확인하세요', badge: '추천' };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { theme, jsonlAnalysis, clientContext, referenceImageBase64, useAiBackground } = await req.json();

    if (!theme) return NextResponse.json({ error: 'theme is required' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    const isDev = !apiKey || apiKey === 'dummy_key';

    // Dev fallback
    if (isDev) {
      await new Promise(r => setTimeout(r, 1000));
      return NextResponse.json({ url: referenceImageBase64 || '' });
    }

    // Prefer COLE-style LLM layout generation; fall back to the heuristic
    // builder if the model output is unusable or generation fails.
    let layerDocument = await generateLayerDocument({
      openai,
      theme,
      jsonlAnalysis: jsonlAnalysis ?? '',
      clientContext: clientContext ?? '',
      photoSrc: referenceImageBase64 || undefined,
    });

    if (!layerDocument) {
      const style = parseDNA(jsonlAnalysis ?? '');
      const copy = await generateCopy(theme, clientContext ?? '');
      layerDocument = buildCardLayerDocument({
        style,
        copy,
        photoSrc: referenceImageBase64 || undefined,
      });
    }

    // Optional Phase 2: swap in a text-free AI background. Korean copy stays as
    // editable text layers on top. Silently skipped if the provider is not
    // configured or generation fails, so the base flow is never blocked.
    if (useAiBackground) {
      const bg = await generateBackground(theme);
      if (bg.ok) {
        const existing = layerDocument.layers.find((l) => l.type === 'background');
        if (existing && existing.type === 'background') {
          existing.source = 'ai';
          existing.value = bg.url;
        } else {
          layerDocument.layers.unshift({ id: 'bg', type: 'background', source: 'ai', value: bg.url, overlayOpacity: 0.45, z: 0 });
          layerDocument.canvas = { w: CANVAS_W, h: CANVAS_H };
        }
      }
    }

    const valid = validateLayerDocument(layerDocument);
    if (!valid.ok) {
      return NextResponse.json({ error: `invalid layer document: ${valid.error}` }, { status: 500 });
    }

    const html = layerDocumentToHtml(layerDocument);
    const url = await htmlToImage(html);
    // Return the editable layer tree alongside the rendered preview so the
    // client can re-render after the user edits individual layers.
    return NextResponse.json({ url, layerDocument });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[render-card]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
