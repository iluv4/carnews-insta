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

const templates: MatchableTemplate[] = [
  { id: 'ux_trend_2026', name: '2026 UX Trend', tags: ['Tech'] },
  { id: 'magazine_news', name: 'Magazine News' },
];

describe('resolveTemplateId', () => {
  it('returns an exact id match', () => {
    expect(resolveTemplateId('ux_trend_2026', templates)).toBe('ux_trend_2026');
  });

  it('strips an "Answer:" prefix and surrounding quotes', () => {
    expect(resolveTemplateId('Answer: ux_trend_2026', templates)).toBe('ux_trend_2026');
    expect(resolveTemplateId('"magazine_news"', templates)).toBe('magazine_news');
    expect(resolveTemplateId('  `ux_trend_2026` ', templates)).toBe('ux_trend_2026');
  });

  it('recovers a valid id embedded in a chattier reply', () => {
    expect(resolveTemplateId('I think magazine_news fits best', templates)).toBe('magazine_news');
  });

  it('falls back to the first template for empty / hallucinated replies', () => {
    expect(resolveTemplateId(null, templates)).toBe('ux_trend_2026');
    expect(resolveTemplateId('', templates)).toBe('ux_trend_2026');
    expect(resolveTemplateId('totally_made_up', templates)).toBe('ux_trend_2026');
  });

  it('returns null when there are no templates', () => {
    expect(resolveTemplateId('anything', [])).toBeNull();
  });
});

describe('resolvePersona', () => {
  it('resolves a known persona by id', () => {
    expect(resolvePersona('car_news_editor').id).toBe('car_news_editor');
  });

  it('falls back to the first persona for unknown / nullish ids', () => {
    expect(resolvePersona('does_not_exist').id).toBe(PERSONAS[0].id);
    expect(resolvePersona(null).id).toBe(PERSONAS[0].id);
    expect(resolvePersona(undefined).id).toBe(PERSONAS[0].id);
  });
});

describe('buildLayoutMessages', () => {
  it('produces system + user messages and one image_url block per image', () => {
    const msgs = buildLayoutMessages(['https://a/1.jpg', 'https://a/2.jpg']);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    const content = msgs[1].content as Array<{ type: string }>;
    const images = content.filter((c) => c.type === 'image_url');
    expect(images).toHaveLength(2);
  });
});

describe('buildTemplateMatchMessages', () => {
  it('lists every template id in the user prompt', () => {
    const msgs = buildTemplateMatchMessages('theme', templates);
    const user = msgs[1].content as string;
    expect(user).toContain('ux_trend_2026');
    expect(user).toContain('magazine_news');
    expect(user).toContain('theme');
  });
});

describe('buildAmazonCopyMessages', () => {
  it('localizes the copywriter instruction by language', () => {
    const ko = buildAmazonCopyMessages({
      productName: 'Serum', brand: 'B', ingredients: 'x', benefits: 'y', howToUse: 'z', lang: 'ko',
    });
    expect(ko[0].content as string).toContain('한국어로');
    const ja = buildAmazonCopyMessages({
      productName: 'Serum', brand: 'B', ingredients: 'x', benefits: 'y', howToUse: 'z', lang: 'ja',
    });
    expect(ja[0].content as string).toContain('日本語で');
    const en = buildAmazonCopyMessages({
      productName: 'Serum', brand: 'B', ingredients: 'x', benefits: 'y', howToUse: 'z', lang: 'en',
    });
    expect(en[0].content as string).toContain('in English');
  });
});

describe('buildPromptRefineMessages', () => {
  it('injects the persona role and the raw prompt', () => {
    const persona = resolvePersona('car_news_editor');
    const msgs = buildPromptRefineMessages('전기차 어때', persona);
    const user = msgs[1].content as string;
    expect(user).toContain('전기차 어때');
    expect(user).toContain(persona.role);
  });
});
