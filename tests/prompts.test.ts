import { describe, it, expect } from 'vitest';
import {
  resolveTemplateId,
  resolvePersona,
  buildTemplateMatchMessages,
  buildLayoutMessages,
  buildAmazonCopyMessages,
  buildPromptRefineMessages,
  PERSONAS,
  type MatchableTemplate,
} from '@/lib/prompts';

const TEMPLATES: MatchableTemplate[] = [
  { id: 'ux_trend_2026', name: '2026 UX Trend', tags: ['Tech', 'Future'] },
  { id: 'magazine_news', name: 'Magazine News', tags: ['Lifestyle'] },
];

describe('resolveTemplateId', () => {
  it('returns null when there are no templates', () => {
    expect(resolveTemplateId('anything', [])).toBeNull();
  });

  it('falls back to the first template for empty/nullish replies', () => {
    expect(resolveTemplateId(null, TEMPLATES)).toBe('ux_trend_2026');
    expect(resolveTemplateId(undefined, TEMPLATES)).toBe('ux_trend_2026');
    expect(resolveTemplateId('', TEMPLATES)).toBe('ux_trend_2026');
  });

  it('accepts an exact id', () => {
    expect(resolveTemplateId('magazine_news', TEMPLATES)).toBe('magazine_news');
  });

  it('strips an "Answer:" prefix the model sometimes echoes', () => {
    expect(resolveTemplateId('Answer: magazine_news', TEMPLATES)).toBe('magazine_news');
    expect(resolveTemplateId('answer:magazine_news', TEMPLATES)).toBe('magazine_news');
  });

  it('strips surrounding quotes/backticks and whitespace', () => {
    expect(resolveTemplateId('  "magazine_news" ', TEMPLATES)).toBe('magazine_news');
    expect(resolveTemplateId('`ux_trend_2026`', TEMPLATES)).toBe('ux_trend_2026');
  });

  it('recovers a valid id embedded in a chattier reply', () => {
    expect(
      resolveTemplateId('I think the best one is magazine_news for this.', TEMPLATES)
    ).toBe('magazine_news');
  });

  it('falls back to the first template for a hallucinated id', () => {
    expect(resolveTemplateId('totally_made_up', TEMPLATES)).toBe('ux_trend_2026');
  });
});

describe('resolvePersona', () => {
  it('resolves a known persona id', () => {
    expect(resolvePersona('car_news_editor').id).toBe('car_news_editor');
  });

  it('falls back to the first persona for unknown/nullish ids', () => {
    expect(resolvePersona('nope').id).toBe(PERSONAS[0].id);
    expect(resolvePersona(null).id).toBe(PERSONAS[0].id);
    expect(resolvePersona(undefined).id).toBe(PERSONAS[0].id);
  });

  it('keeps persona ids unique (single source of truth)', () => {
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildTemplateMatchMessages', () => {
  it('emits a system + user message pair', () => {
    const msgs = buildTemplateMatchMessages('자동차 신차 소식', TEMPLATES);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('lists every candidate id and the queried theme in the user prompt', () => {
    const msgs = buildTemplateMatchMessages('자동차 신차 소식', TEMPLATES);
    const user = msgs[1].content as string;
    expect(user).toContain('ux_trend_2026');
    expect(user).toContain('magazine_news');
    expect(user).toContain('자동차 신차 소식');
  });

  it('includes tags only when present', () => {
    const user = buildTemplateMatchMessages('x', [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', tags: ['One', 'Two'] },
    ])[1].content as string;
    expect(user).toContain('tags: One, Two');
    expect(user).toContain('- id: a | name: A\n');
  });
});

describe('buildLayoutMessages', () => {
  it('attaches each image url as an image_url content block after the instruction', () => {
    const msgs = buildLayoutMessages(['https://img/1.jpg', 'https://img/2.jpg']);
    expect(msgs[0].role).toBe('system');
    const content = msgs[1].content as Array<{ type: string; image_url?: { url: string } }>;
    expect(content[0].type).toBe('text');
    const images = content.filter((c) => c.type === 'image_url');
    expect(images.map((i) => i.image_url!.url)).toEqual(['https://img/1.jpg', 'https://img/2.jpg']);
  });

  it('produces just the instruction block when no images are given', () => {
    const content = buildLayoutMessages([])[1].content as unknown[];
    expect(content).toHaveLength(1);
  });
});

describe('buildAmazonCopyMessages', () => {
  const input = {
    productName: 'Glow Serum',
    brand: 'Acme',
    ingredients: 'Niacinamide',
    benefits: 'Brightening',
    howToUse: 'Apply AM/PM',
    lang: 'en',
  };

  it('injects all product fields into the user prompt', () => {
    const user = buildAmazonCopyMessages(input)[1].content as string;
    expect(user).toContain('Glow Serum');
    expect(user).toContain('Acme');
    expect(user).toContain('Niacinamide');
    expect(user).toContain('Apply AM/PM');
  });

  it('localizes the language directive per lang', () => {
    expect(buildAmazonCopyMessages({ ...input, lang: 'ko' })[0].content).toContain('한국어로');
    expect(buildAmazonCopyMessages({ ...input, lang: 'ja' })[0].content).toContain('日本語で');
    expect(buildAmazonCopyMessages({ ...input, lang: 'en' })[0].content).toContain('in English');
  });

  it('defaults unknown languages to English', () => {
    expect(buildAmazonCopyMessages({ ...input, lang: 'fr' })[0].content).toContain('in English');
  });

  it('keeps the Amazon-policy guardrails in the system message', () => {
    const system = buildAmazonCopyMessages(input)[0].content as string;
    expect(system.toLowerCase()).toContain('never make medical');
  });
});

describe('buildPromptRefineMessages', () => {
  it('embeds the raw prompt, persona role, and guide into the user message', () => {
    const persona = resolvePersona('car_news_editor');
    const user = buildPromptRefineMessages('테슬라 신차 나왔대', persona)[1].content as string;
    expect(user).toContain('테슬라 신차 나왔대');
    expect(user).toContain(persona.role);
    expect(user).toContain(persona.guide);
  });

  it('asks for the refined/notes JSON contract', () => {
    const user = buildPromptRefineMessages('x', PERSONAS[0])[1].content as string;
    expect(user).toContain('"refined"');
    expect(user).toContain('"notes"');
  });
});
