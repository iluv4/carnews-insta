import { describe, it, expect } from 'vitest';
import {
  buildFabricSpec,
  fallbackLayout,
  CARD_W,
  CARD_H,
  type CardCopy,
} from '@/lib/fabricSpec';

describe('fallbackLayout', () => {
  it('builds the requested number of slides with cover/closing roles', () => {
    const layout = fallbackLayout(3);
    expect(layout.slides).toHaveLength(3);
    expect(layout.slides[0].role).toBe('cover');
    expect(layout.slides[2].role).toBe('closing');
    expect(layout.slides[1].role).toBe('info');
  });
});

describe('buildFabricSpec', () => {
  const copy: CardCopy = {
    title: 'Hello',
    subtitle: 'Sub',
    bullets: ['one', 'two', 'three'],
    footer: 'Swipe',
    brand: 'BrandX',
  };

  it('uses the canonical card dimensions', () => {
    const spec = buildFabricSpec(fallbackLayout(3), 0, 'https://img/1.jpg', copy);
    expect(spec.width).toBe(CARD_W);
    expect(spec.height).toBe(CARD_H);
  });

  it('uses a photo background + overlay for photo slides', () => {
    const spec = buildFabricSpec(fallbackLayout(3), 0, 'https://img/1.jpg', copy);
    expect(spec.background.type).toBe('image');
    expect(spec.overlay).toBeDefined();
  });

  it('renders the title text', () => {
    const spec = buildFabricSpec(fallbackLayout(3), 0, 'https://img/1.jpg', copy);
    const titleObj = spec.objects.find((o) => o.type === 'text' && o.text === 'Hello');
    expect(titleObj).toBeDefined();
  });

  it('falls back to the last slide meta when slideIndex is out of range', () => {
    const layout = fallbackLayout(3);
    const spec = buildFabricSpec(layout, 99, 'https://img/1.jpg', copy);
    // Should not throw and should still produce a valid spec.
    expect(spec.objects.length).toBeGreaterThan(0);
  });

  it('keeps every object within the card bounds horizontally', () => {
    const spec = buildFabricSpec(fallbackLayout(3), 0, 'https://img/1.jpg', copy);
    for (const o of spec.objects) {
      expect(o.left).toBeGreaterThanOrEqual(0);
      expect(o.left).toBeLessThanOrEqual(CARD_W);
    }
  });
});
