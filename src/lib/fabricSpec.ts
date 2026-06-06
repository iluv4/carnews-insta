// Fabric.js card spec — server builds, client renders via CanvasEditor.

export const CARD_W = 1080;
export const CARD_H = 1620;

export type Pos =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type SlideRole = 'cover' | 'review' | 'menu' | 'cta' | 'info' | 'closing';

export interface LayoutTemplate {
  type: 'layout';
  slides: Array<{
    role: SlideRole;
    bg: 'photo-fullbleed' | 'photo-collage' | 'color';
    title: { pos: Pos; weight: number; color: string; accent_bar: 'left' | 'none' };
    body: {
      pos: Pos;
      style: 'emoji-bullet' | 'paragraph' | 'none';
      emojis?: string[];
      color: string;
    };
    footer?: { pos: Pos; text_role: 'caption' | 'cta-arrow' | 'brand'; color?: string };
  }>;
  palette: { primary: string; accent: string; text: string; overlay: string };
  typography: { family: string; weight_title: number; weight_body: number };
  decor: { brand_mark?: { pos: Pos; text?: string }; motifs: string[] };
}

export interface SubjectBrief {
  subject: string;
  ingredients: string[];
  mood?: string;
  focal_zone?: string;
  brand_hint?: string;
}

export interface CardCopy {
  title: string;
  subtitle?: string;
  bullets?: string[];
  footer?: string;
  brand?: string;
}

export type FabricObjSpec =
  | { type: 'rect'; left: number; top: number; width: number; height: number; fill: string; rx?: number }
  | {
      type: 'text';
      left: number;
      top: number;
      text: string;
      fontSize: number;
      fontWeight: number | string;
      fill: string;
      fontFamily: string;
      textAlign?: 'left' | 'center' | 'right';
      lineHeight?: number;
      width?: number;
      shadow?: string;
    }
  | { type: 'image'; left: number; top: number; width: number; height: number; src: string; objectFit?: 'cover' | 'contain' };

export interface FabricSpec {
  width: number;
  height: number;
  background:
    | { type: 'image'; src: string; objectFit: 'cover' | 'contain' }
    | { type: 'color'; color: string };
  overlay?: { color: string };
  objects: FabricObjSpec[];
}

const PAD = 80;

function anchorXY(pos: Pos, w: number, h: number): { x: number; y: number } {
  const xs = { left: PAD, center: w / 2, right: w - PAD };
  const ys = { top: 240, middle: h / 2, bottom: h - 320 };
  const [v, hAlign] = pos.split('-') as ['top' | 'middle' | 'bottom', 'left' | 'center' | 'right'];
  return { x: xs[hAlign] ?? PAD, y: ys[v] ?? 240 };
}

function alignFromPos(pos: Pos): 'left' | 'center' | 'right' {
  if (pos.endsWith('center')) return 'center';
  if (pos.endsWith('right')) return 'right';
  return 'left';
}

export function buildFabricSpec(
  layout: LayoutTemplate,
  slideIndex: number,
  sourceImage: string,
  copy: CardCopy
): FabricSpec {
  const slideMeta = layout.slides[slideIndex] ?? layout.slides[layout.slides.length - 1];
  const palette = layout.palette;
  const fontFamily = layout.typography?.family || 'Pretendard';
  const weightTitle = layout.typography?.weight_title || 900;
  const weightBody = layout.typography?.weight_body || 600;

  const objects: FabricObjSpec[] = [];

  const bg: FabricSpec['background'] =
    slideMeta.bg === 'color'
      ? { type: 'color', color: palette.primary || '#0a0a0a' }
      : { type: 'image', src: sourceImage, objectFit: 'cover' };

  const overlay = slideMeta.bg !== 'color' ? { color: palette.overlay || 'rgba(0,0,0,0.45)' } : undefined;

  // ── Title block ──
  const titleAnchor = anchorXY(slideMeta.title.pos, CARD_W, CARD_H);
  const titleAlign = alignFromPos(slideMeta.title.pos);
  const titleFontSize = 84;
  const titleColor = slideMeta.title.color || palette.text || '#ffffff';
  const titleWidth = CARD_W - PAD * 2;

  if (slideMeta.title.accent_bar === 'left') {
    objects.push({
      type: 'rect',
      left: titleAnchor.x - 24,
      top: titleAnchor.y - 8,
      width: 8,
      height: titleFontSize * 2.4,
      fill: titleColor,
    });
  }

  if (copy.title) {
    objects.push({
      type: 'text',
      left: titleAnchor.x,
      top: titleAnchor.y,
      text: copy.title,
      fontSize: titleFontSize,
      fontWeight: weightTitle,
      fill: titleColor,
      fontFamily,
      textAlign: titleAlign,
      lineHeight: 1.2,
      width: titleWidth,
      shadow: '2px 2px 8px rgba(0,0,0,0.5)',
    });
  }

  if (copy.subtitle) {
    objects.push({
      type: 'text',
      left: titleAnchor.x,
      top: titleAnchor.y + titleFontSize * 2.6,
      text: copy.subtitle,
      fontSize: 44,
      fontWeight: weightBody,
      fill: titleColor,
      fontFamily,
      textAlign: titleAlign,
      lineHeight: 1.3,
      width: titleWidth,
    });
  }

  // ── Body block ──
  const bodyAnchor = anchorXY(slideMeta.body.pos, CARD_W, CARD_H);
  const bodyAlign = alignFromPos(slideMeta.body.pos);
  const bodyColor = slideMeta.body.color || palette.text || '#ffffff';

  if (slideMeta.body.style === 'emoji-bullet' && copy.bullets && copy.bullets.length > 0) {
    const lineH = 90;
    copy.bullets.slice(0, 4).forEach((line, i) => {
      objects.push({
        type: 'text',
        left: bodyAnchor.x,
        top: bodyAnchor.y + i * lineH,
        text: line,
        fontSize: 44,
        fontWeight: weightBody,
        fill: bodyColor,
        fontFamily,
        textAlign: bodyAlign,
        lineHeight: 1.3,
        width: CARD_W - PAD * 2,
        shadow: '1px 1px 4px rgba(0,0,0,0.5)',
      });
    });
  } else if (slideMeta.body.style === 'paragraph' && copy.bullets) {
    objects.push({
      type: 'text',
      left: bodyAnchor.x,
      top: bodyAnchor.y,
      text: copy.bullets.join('\n'),
      fontSize: 44,
      fontWeight: weightBody,
      fill: bodyColor,
      fontFamily,
      textAlign: bodyAlign,
      lineHeight: 1.4,
      width: CARD_W - PAD * 2,
      shadow: '1px 1px 4px rgba(0,0,0,0.5)',
    });
  }

  // ── Footer / CTA ──
  if (copy.footer && slideMeta.footer) {
    const f = anchorXY(slideMeta.footer.pos, CARD_W, CARD_H);
    const fAlign = alignFromPos(slideMeta.footer.pos);
    const footerColor = slideMeta.footer.color || palette.accent || '#ffffff';
    const text =
      slideMeta.footer.text_role === 'cta-arrow'
        ? `➡️ ${copy.footer}`
        : copy.footer;
    objects.push({
      type: 'text',
      left: f.x,
      top: f.y,
      text,
      fontSize: 38,
      fontWeight: weightBody,
      fill: footerColor,
      fontFamily,
      textAlign: fAlign,
      lineHeight: 1.3,
      width: CARD_W - PAD * 2,
      shadow: '1px 1px 4px rgba(0,0,0,0.5)',
    });
  }

  // ── Brand mark ──
  const brand = copy.brand || layout.decor?.brand_mark?.text;
  if (brand && layout.decor?.brand_mark?.pos) {
    const b = anchorXY(layout.decor.brand_mark.pos, CARD_W, CARD_H);
    const bAlign = alignFromPos(layout.decor.brand_mark.pos);
    objects.push({
      type: 'text',
      left: b.x,
      top: 80,
      text: brand,
      fontSize: 36,
      fontWeight: weightTitle,
      fill: palette.text || '#ffffff',
      fontFamily,
      textAlign: bAlign,
      lineHeight: 1.2,
      width: CARD_W / 2,
      shadow: '1px 1px 4px rgba(0,0,0,0.5)',
    });
  }

  return { width: CARD_W, height: CARD_H, background: bg, overlay, objects };
}

export function fallbackLayout(slideCount = 3): LayoutTemplate {
  const slides: LayoutTemplate['slides'] = Array.from({ length: slideCount }, (_, i) => ({
    role: i === 0 ? 'cover' : i === slideCount - 1 ? 'closing' : 'info',
    bg: 'photo-fullbleed',
    title: { pos: 'top-left', weight: 900, color: '#ffffff', accent_bar: 'left' },
    body: {
      pos: i === 0 ? 'middle-left' : 'bottom-left',
      style: i === 0 ? 'emoji-bullet' : 'paragraph',
      emojis: ['😍', '😎', '🤤'],
      color: '#ffffff',
    },
    footer:
      i === slideCount - 1
        ? { pos: 'bottom-left', text_role: 'cta-arrow', color: '#ffffff' }
        : { pos: 'bottom-left', text_role: 'caption', color: '#ffffff' },
  }));
  return {
    type: 'layout',
    slides,
    palette: {
      primary: '#ffffff',
      accent: '#ff6b35',
      text: '#ffffff',
      overlay: 'rgba(0,0,0,0.45)',
    },
    typography: { family: 'Pretendard', weight_title: 900, weight_body: 600 },
    decor: { brand_mark: { pos: 'top-right' }, motifs: ['left-accent-bar', 'emoji-bullet'] },
  };
}
