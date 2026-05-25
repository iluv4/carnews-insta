import { NextResponse } from 'next/server';
import { validateLayerDocument } from '@/lib/layerSchema';
import { layerDocumentToHtml } from '@/lib/layerRenderer';
import { htmlToImage } from '@/lib/puppeteerShot';

export const maxDuration = 60;

// Re-render an edited layer document back into a flat preview image.
// Takes the LayerDocument produced by /api/render-card after the client
// has edited individual layers (text content, positions, visibility, …).
export async function POST(req: Request) {
  try {
    const { layerDocument } = await req.json();

    const valid = validateLayerDocument(layerDocument);
    if (!valid.ok) {
      return NextResponse.json({ error: `invalid layer document: ${valid.error}` }, { status: 400 });
    }

    const html = layerDocumentToHtml(valid.doc);
    const url = await htmlToImage(html, valid.doc.canvas.w, valid.doc.canvas.h);
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('[render-layers]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
