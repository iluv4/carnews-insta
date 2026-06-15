import { describe, it, expect } from 'vitest';
import {
  buildFabricSpec,
  fallbackLayout,
  CARD_W,
  CARD_H,
  type FabricObjSpec,
  type CardCopy,
} from '@/lib/fabricSpec';

const texts = (objs: FabricObjSpec[]) =>
  objs.filter((o): o is Extract<FabricObjSpec, { type: 'text' }> => o.type === 'text');

describe('fallbackLayout', () => {
  it('builds the requested number of slides', () => {
    expect(fallbackLayout(5).slides).toHaveLength(5);
  });

  it('defaults to 3 slides', () => {
    expect(fallbackLayout().slides).toHaveLength(3);
  });

  it('labels first slide cover, last closing, middles info', () => {
    const roles = fallbackLayout(4).slides.map((s) => s.role);
    expect(roles).toEqual(['cover', 'info', 'info', 'closing']);
  });

  it('gives the final slide a cta-arrow footer', () => {
    const { slides } = fallbackLayout(3);
    expect(slides[2].footer?.text_role).toBe('cta-arrow');
    expect(slides[0].footer?.text_role).toBe('caption');
  });
});

describe('buildFabricSpec', () => {
  const layout = fallbackLayout(3);
  const copy: CardCopy = {
    title: '제목입니다',
    subtitle: '부제목',
    bullets: ['포인트1', '포인트2'],
    footer: '더 보기',
    brand: 'CARNEWS',
  };

  it('uses the canvas dimensions', () => {
    const spec = buildFabricSpec(layout, 0, 'https://img/x.jpg', copy);
    expect(spec.width).toBe(CARD_W);
    expect(spec.height).toBe(CARD_H);
  });

  it('uses a photo background + dark overlay for photo-fullbleed slides', () => {
    const spec = buildFabricSpec(layout, 0, 'https://img/x.jpg', copy);
    expect(spec.background).toEqual({ type: 'image', src: 'https://img/x.jpg', objectFit: 'cover' });
    expect(spec.overlay).toBeDefined();
  });

  it('uses a color background with no overlay when bg=color', () => {
    const colorLayout = fallbackLayout(1);
    colorLayout.slides[0].bg = 'color';
    const spec = buildFabricSpec(colorLayout, 0, 'unused', copy);
    expect(spec.background.type).toBe('color');
    expect(spec.overlay).toBeUndefined();
  });

  it('renders the title text', () => {
    const spec = buildFabricSpec(layout, 0, 'https://img/x.jpg', copy);
    expect(texts(spec.objects).some((t) => t.text === '제목입니다')).toBe(true);
  });

  it('draws a left accent bar (rect) when accent_bar=left', () => {
    const spec = buildFabricSpec(layout, 0, 'https://img/x.jpg', copy);
    expect(spec.objects.some((o) => o.type === 'rect')).toBe(true);
  });

  it('omits the accent bar when accent_bar=none', () => {
    const l = fallbackLayout(1);
    l.slides[0].title.accent_bar = 'none';
    const spec = buildFabricSpec(l, 0, 'https://img/x.jpg', copy);
    expect(spec.objects.some((o) => o.type === 'rect')).toBe(false);
  });

  it('prefixes the footer with an arrow for cta-arrow footers', () => {
    const spec = buildFabricSpec(layout, 2, 'https://img/x.jpg', copy);
    expect(texts(spec.objects).some((t) => t.text.includes('➡️') && t.text.includes('더 보기'))).toBe(true);
  });

  it('caps emoji-bullet body lines at 4', () => {
    const l = fallbackLayout(1);
    l.slides[0].body.style = 'emoji-bullet';
    const many: CardCopy = { title: 'T', bullets: ['1', '2', '3', '4', '5', '6'] };
    const spec = buildFabricSpec(l, 0, 'https://img/x.jpg', many);
    const bulletTexts = texts(spec.objects).filter((t) => /^[1-6]$/.test(t.text));
    expect(bulletTexts).toHaveLength(4);
  });

  it('joins bullets into one block for paragraph style', () => {
    const l = fallbackLayout(1);
    l.slides[0].body.style = 'paragraph';
    const spec = buildFabricSpec(l, 0, 'https://img/x.jpg', { title: 'T', bullets: ['a', 'b'] });
    expect(texts(spec.objects).some((t) => t.text === 'a\nb')).toBe(true);
  });

  it('falls back to the last slide template when slideIndex is out of range', () => {
    const spec = buildFabricSpec(layout, 99, 'https://img/x.jpg', copy);
    // last fallback slide has a cta-arrow footer → arrow prefix appears
    expect(texts(spec.objects).some((t) => t.text.includes('➡️'))).toBe(true);
  });

  it('skips the title object entirely when copy.title is empty', () => {
    const spec = buildFabricSpec(layout, 0, 'https://img/x.jpg', { title: '' });
    expect(texts(spec.objects).some((t) => t.text === '')).toBe(false);
  });

  it('keeps every text object horizontally inside the canvas width', () => {
    const spec = buildFabricSpec(layout, 0, 'https://img/x.jpg', copy);
    for (const t of texts(spec.objects)) {
      expect(t.left).toBeGreaterThanOrEqual(0);
      expect(t.left).toBeLessThanOrEqual(CARD_W);
    }
  });
});
