// Builds an editable LayerDocument from the existing Design-DNA JSONL + copy.
// This is the bridge between the current pipeline (DNA + Korean copy) and the
// new layer-based representation, so the flat-raster path can be migrated
// incrementally without changing the analyze/copy prompts.

import { CANVAS_W, CANVAS_H, type Layer, type LayerDocument } from './layerSchema';

export interface CardStyle {
  bgColor: string;
  textColor: string;
  accentColor: string;
  overlayOpacity: number;
  fontWeight: string;
}

export interface CardCopy {
  headline: string;
  subheadline: string;
  badge: string;
}

// Mirror of render-card's parseDNA, kept here so the layer pipeline owns it.
export function parseDNA(jsonl: string): CardStyle {
  const defaults: CardStyle = {
    bgColor: '#111111',
    textColor: '#ffffff',
    accentColor: '#ff6b35',
    overlayOpacity: 0.55,
    fontWeight: '800',
  };
  try {
    const lines = jsonl
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];

    const palette = lines.find((l) => l.type === 'color_palette');
    const bg = lines.find((l) => l.type === 'background_dna');
    const typo = lines.find((l) => l.type === 'typography_dna');
    const colors: string[] = (palette?.colors as string[]) ?? [];

    return {
      bgColor: (bg?.primary as string) ?? colors[0] ?? defaults.bgColor,
      textColor:
        (typo?.primary_color as string) ??
        colors.find((c) => /fff|white/i.test(c)) ??
        defaults.textColor,
      accentColor: (typo?.accent_color as string) ?? colors[1] ?? defaults.accentColor,
      overlayOpacity: String(bg?.texture ?? '').includes('glass') ? 0.4 : 0.55,
      fontWeight: (typo?.weight as string) ?? defaults.fontWeight,
    };
  } catch {
    return defaults;
  }
}

export function buildCardLayerDocument(params: {
  style: CardStyle;
  copy: CardCopy;
  photoSrc?: string;
}): LayerDocument {
  const { style, copy, photoSrc } = params;
  const layers: Layer[] = [];

  if (photoSrc) {
    layers.push({ id: 'bg', type: 'background', source: 'image', value: photoSrc, overlayOpacity: style.overlayOpacity, z: 0 });
  } else {
    layers.push({ id: 'bg', type: 'background', source: 'solid', value: style.bgColor, overlayOpacity: style.overlayOpacity, z: 0 });
  }

  if (copy.badge) {
    layers.push({ id: 'badge-bg', type: 'shape', shape: 'circle', bbox: { x: CANVAS_W - 188, y: 48, w: 140, h: 140 }, fill: style.bgColor, z: 10 });
    layers.push({
      id: 'badge-text', type: 'text', editable: true,
      bbox: { x: CANVAS_W - 188, y: 48, w: 140, h: 140 },
      content: copy.badge, color: style.accentColor, fontWeight: 900, fontSize: 36,
      align: 'center', lineHeight: 1.2, z: 11,
    });
  }

  if (copy.subheadline) {
    layers.push({
      id: 'subheadline', type: 'text', editable: true,
      bbox: { x: 60, y: CANVAS_H - 360, w: CANVAS_W - 120, h: 60 },
      content: copy.subheadline, color: style.textColor, fontWeight: 400, fontSize: 36,
      align: 'left', z: 20,
    });
  }

  layers.push({
    id: 'headline', type: 'text', editable: true,
    bbox: { x: 60, y: CANVAS_H - 300, w: CANVAS_W - 120, h: 220 },
    content: copy.headline, color: style.textColor, fontWeight: style.fontWeight, fontSize: 96,
    align: 'left', lineHeight: 1.15, letterSpacing: -2,
    shadow: '0 2px 12px rgba(0,0,0,0.5)', z: 21,
  });

  layers.push({ id: 'accent-line', type: 'shape', shape: 'rect', bbox: { x: 60, y: CANVAS_H - 64, w: 80, h: 6 }, fill: style.accentColor, radius: 3, z: 22 });

  return { canvas: { w: CANVAS_W, h: CANVAS_H }, layers };
}
