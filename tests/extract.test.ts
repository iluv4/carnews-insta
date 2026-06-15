import { describe, it, expect, afterEach } from 'vitest';
import { hasOpenAIKey, cleanText, verifyBrief, loadSource, type CardBrief } from '@/lib/extract';

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
});

describe('hasOpenAIKey', () => {
  it('is false when unset or set to a known placeholder', () => {
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
  it('strips carriage returns and collapses horizontal whitespace', () => {
    expect(cleanText('a\r\nb   c\t\td')).toBe('a\nb c d');
  });

  it('collapses 3+ consecutive newlines down to a paragraph break', () => {
    expect(cleanText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims leading/trailing whitespace', () => {
    expect(cleanText('   hello   ')).toBe('hello');
  });

  it('truncates with an ellipsis once past maxChars', () => {
    const out = cleanText('abcdefghij', 5);
    expect(out).toBe('abcde…');
  });

  it('does not truncate content at or under the limit', () => {
    expect(cleanText('abcde', 5)).toBe('abcde');
  });
});

describe('verifyBrief', () => {
  const make = (roles: CardBrief['slides'][number]['role'][]): CardBrief => ({
    headline: 'h',
    summary: 's',
    key_points: ['a', 'b', 'c'],
    entities: [],
    tone: 'informative',
    slides: roles.map((role, i) => ({ role, title: `t${i}`, body: `b${i}` })),
  });

  it('forces the first slide to cover and the last to cta', () => {
    const out = verifyBrief(make(['point', 'point', 'point']));
    expect(out.slides[0].role).toBe('cover');
    expect(out.slides[out.slides.length - 1].role).toBe('cta');
  });

  it('coerces all middle slides to point', () => {
    const out = verifyBrief(make(['cta', 'cover', 'cta', 'cover']));
    expect(out.slides.map((s) => s.role)).toEqual(['cover', 'point', 'point', 'cta']);
  });

  it('preserves slide titles/bodies and other brief fields', () => {
    const out = verifyBrief(make(['point', 'point']));
    expect(out.headline).toBe('h');
    expect(out.slides[0].title).toBe('t0');
    expect(out.slides[1].body).toBe('b1');
  });

  it('handles a single slide (first == last → cta wins)', () => {
    const out = verifyBrief(make(['point']));
    expect(out.slides[0].role).toBe('cta');
  });

  it('does not mutate the input brief', () => {
    const input = make(['point', 'point', 'point']);
    verifyBrief(input);
    expect(input.slides[0].role).toBe('point');
  });

  it('tolerates an empty slide list', () => {
    const out = verifyBrief(make([]));
    expect(out.slides).toEqual([]);
  });
});

describe('loadSource (non-URL path)', () => {
  it('returns plain text input verbatim without fetching', async () => {
    const result = await loadSource('그냥 본문 텍스트입니다');
    expect(result).toEqual({ text: '그냥 본문 텍스트입니다' });
  });

  it('treats leading whitespace + non-http content as text', async () => {
    const result = await loadSource('   ftp://not-http-scheme');
    expect(result.text).toBe('   ftp://not-http-scheme');
    expect(result.url).toBeUndefined();
  });
});
