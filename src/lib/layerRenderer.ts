// Renders a LayerDocument to HTML. The HTML feeds the same Puppeteer
// screenshot path used by render-card, and can also be reused for an
// in-browser editable preview (each layer is a positioned element).

import type { Layer, LayerDocument, BackgroundLayer, ImageLayer, TextLayer, ShapeLayer, BBox } from './layerSchema';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bboxStyle(b: BBox): string {
  return `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;`;
}

function renderLayer(layer: Layer): string {
  if (layer.visible === false) return '';
  const z = `z-index:${layer.z};`;

  switch (layer.type) {
    case 'background': {
      const l = layer as BackgroundLayer;
      const base =
        l.source === 'image'
          ? `background:url('${l.value}') center/cover no-repeat;`
          : l.source === 'gradient'
            ? `background:${l.value};`
            : `background:${l.value};`;
      const overlay =
        l.overlayOpacity && l.overlayOpacity > 0
          ? `<div style="position:absolute;inset:0;z-index:${l.z + 1};background:linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,rgba(0,0,0,${l.overlayOpacity * 0.4}) 50%,rgba(0,0,0,${l.overlayOpacity + 0.2}) 100%);"></div>`
          : '';
      return `<div style="position:absolute;inset:0;${z}${base}"></div>${overlay}`;
    }
    case 'image': {
      const l = layer as ImageLayer;
      const radius = l.radius ? `border-radius:${l.radius}px;` : '';
      return `<div style="${bboxStyle(l.bbox)}${z}background:url('${l.src}') center/${l.fit ?? 'cover'} no-repeat;${radius}overflow:hidden;"></div>`;
    }
    case 'text': {
      const l = layer as TextLayer;
      const style =
        bboxStyle(l.bbox) +
        z +
        `color:${l.color};font-weight:${l.fontWeight};font-size:${l.fontSize}px;` +
        `text-align:${l.align ?? 'left'};line-height:${l.lineHeight ?? 1.15};` +
        `letter-spacing:${l.letterSpacing ?? -1}px;word-break:keep-all;` +
        (l.shadow ? `text-shadow:${l.shadow};` : '') +
        'display:flex;flex-direction:column;justify-content:flex-end;';
      return `<div data-layer-id="${l.id}" data-editable="true" style="${style}">${escapeHtml(l.content)}</div>`;
    }
    case 'shape': {
      const l = layer as ShapeLayer;
      const radius =
        l.shape === 'circle' ? 'border-radius:50%;' : l.radius ? `border-radius:${l.radius}px;` : '';
      const fill = l.fill ? `background:${l.fill};` : '';
      const stroke = l.stroke ? `border:${l.strokeWidth ?? 2}px solid ${l.stroke};` : '';
      return `<div style="${bboxStyle(l.bbox)}${z}${fill}${stroke}${radius}"></div>`;
    }
    default:
      return '';
  }
}

export function layerDocumentToHtml(doc: LayerDocument): string {
  const { w, h } = doc.canvas;
  const sorted = [...doc.layers].sort((a, b) => a.z - b.z);
  const body = sorted.map(renderLayer).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${w}px; height:${h}px; overflow:hidden; }
  .canvas { position:relative; width:${w}px; height:${h}px; font-family:'Noto Sans KR',sans-serif; }
</style>
</head>
<body>
<div class="canvas">
${body}
</div>
</body>
</html>`;
}
