import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hasOpenAIKey, cleanText, verifyBrief, type CardBrief } from '@/lib/extract';

describe('hasOpenAIKey', () => {
  const original = process.env.OPENAI_API_KEY;
  afterEach(() => {
    process.env.OPENAI_API_KEY = original;
  });

  it('is false for missing or placeholder keys', () => {
    delete process.env.OPENAI_API_KEY;
    expect(hasOpenAIKey()).toBe(false);
    process.env.OPENAI_API_KEY = 'dummy_key';
    expect(hasOpenAIKey()).toBe(false);
    process.env.OPENAI_API_KEY = 'your_openai_api_key_here';
    expect(hasOpenAIKey()).toBe(false);
  });

  it('is true for a real-looking key', () => {
    process.env.OPENAI_API_KEY = 'sk-realkey123';
    expect(hasOpenAIKey()).toBe(true);
  });
});

describe('cleanText', () => {
  it('normalizes whitespace and collapses blank lines', () => {
    const out = cleanText('a\r\n\n\n\nb   c\t\td');
    expect(out).not.toContain('\r');
    expect(out).toBe('a\n\nb c d');
  });

  it('truncates to maxChars with an ellipsis', () => {
    const out = cleanText('x'.repeat(100), 10);
    expect(out).toHaveLength(11); // 10 chars + the ellipsis
    expect(out.endsWith('…')).toBe(true);
  });

  it('leaves short text untouched (no ellipsis)', () => {
    expect(cleanText('short', 6000)).toBe('short');
  });
});

describe('verifyBrief', () => {
  const base: CardBrief = {
    headline: 'h',
    summary: 's',
    key_points: ['a', 'b', 'c'],
    entities: [],
    tone: 'informative',
    slides: [
      { role: 'point', title: 't0', body: 'b0' },
      { role: 'point', title: 't1', body: 'b1' },
      { role: 'point', title: 't2', body: 'b2' },
      { role: 'point', title: 't3', body: 'b3' },
    ],
  };

  it('forces first slide to cover and last slide to cta', () => {
    const out = verifyBrief(base);
    expect(out.slides[0].role).toBe('cover');
    expect(out.slides[out.slides.length - 1].role).toBe('cta');
  });

  it('forces every middle slide to point', () => {
    const out = verifyBrief(base);
    expect(out.slides.slice(1, -1).every((s) => s.role === 'point')).toBe(true);
  });

  it('does not mutate the input brief', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    verifyBrief(base);
    expect(base).toEqual(snapshot);
  });
});
