// COLE-style layout generation: instead of placing layers with fixed
// heuristics, the LLM emits the full LayerDocument (positions, hierarchy,
// Korean copy) from the design DNA + theme. The result is validated against
// our schema; callers fall back to the heuristic builder on any failure.

import type OpenAI from 'openai';
import { CANVAS_W, CANVAS_H, validateLayerDocument, type LayerDocument } from './layerSchema';

const SCHEMA_SPEC = `Return ONLY a JSON object with this exact shape (no markdown, no prose):
{
  "canvas": { "w": ${CANVAS_W}, "h": ${CANVAS_H} },
  "layers": [
    { "id": "bg", "type": "background", "source": "solid"|"gradient", "value": "<hex or css-gradient>", "overlayOpacity": 0.0-0.8, "z": 0 },
    { "id": "<unique>", "type": "shape", "shape": "rect"|"circle"|"line", "bbox": {"x":0,"y":0,"w":0,"h":0}, "fill": "<hex>", "radius": <px>, "z": <int> },
    { "id": "<unique>", "type": "text", "editable": true, "bbox": {"x":0,"y":0,"w":0,"h":0}, "content": "<Korean text>", "color": "<hex>", "fontWeight": 100-900, "fontSize": <px>, "align": "left"|"center"|"right", "lineHeight": <num>, "letterSpacing": <px>, "shadow": "<css text-shadow or omit>", "z": <int> }
  ]
}
RULES:
- Canvas is ${CANVAS_W}x${CANVAS_H} px (Instagram 4:5 portrait). All bbox values are absolute px within the canvas.
- Lower z renders behind higher z. Background z=0.
- Provide ONE headline text layer (fontSize 80-110, bold) and optionally one subheadline (fontSize 32-40) and one short badge.
- Render ONLY headline-style copy. NO phone numbers, addresses, hours, or URLs.
- Use colors/typography from the DESIGN DNA. Keep text inside the canvas with comfortable margins (>=48px).`;

export async function generateLayerDocument(opts: {
  openai: OpenAI;
  theme: string;
  jsonlAnalysis: string;
  clientContext?: string;
  photoSrc?: string;
  model?: string;
}): Promise<LayerDocument | null> {
  const { openai, theme, jsonlAnalysis, clientContext, photoSrc, model = 'gpt-4.1-mini' } = opts;

  const prompt = `You are a senior Korean Instagram card-news designer. Design an editable, layered card.

THEME: ${theme}
${clientContext ? `BRAND TONE (style only, do not render as text): ${clientContext}` : ''}

DESIGN DNA (replicate its colors/typography/mood):
${jsonlAnalysis.substring(0, 4000)}

${SCHEMA_SPEC}`;

  try {
    const res = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LayerDocument;

    // Force the real canvas size and inject the user's photo as the background
    // image layer when provided (the model only describes a solid/gradient bg).
    parsed.canvas = { w: CANVAS_W, h: CANVAS_H };
    if (photoSrc) {
      const bg = parsed.layers.find((l) => l.type === 'background');
      if (bg && bg.type === 'background') {
        bg.source = 'image';
        bg.value = photoSrc;
        if (bg.overlayOpacity == null) bg.overlayOpacity = 0.5;
      } else {
        parsed.layers.unshift({ id: 'bg', type: 'background', source: 'image', value: photoSrc, overlayOpacity: 0.5, z: 0 });
      }
    }

    const valid = validateLayerDocument(parsed);
    if (!valid.ok) {
      console.warn('[layerGenerator] invalid generated document:', valid.error);
      return null;
    }
    return valid.doc;
  } catch (e) {
    console.warn('[layerGenerator] generation failed:', (e as Error).message);
    return null;
  }
}
