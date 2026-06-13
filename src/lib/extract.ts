/**
 * LLM 기반 구조화 정보추출(IE) 파이프라인.
 *
 * 뉴스 URL 또는 원문 텍스트를 받아 → 본문 정제 → OpenAI structured outputs
 * (JSON Schema 강제)로 카드뉴스 제작용 구조화 브리프를 추출한다.
 *
 * 단계(orchestration):
 *   1) load   — URL이면 fetch + cheerio로 본문/메타 추출, 텍스트면 그대로 사용
 *   2) clean  — 보일러플레이트 제거 · 길이 제한(토큰 절약)
 *   3) extract— gpt-4o-mini + response_format: json_schema 로 IE 수행
 *   4) verify — 스키마 후처리 · 슬라이드 수 정합성 보정
 *
 * 설계 의도: 자유형 텍스트 → 결정적(deterministic) 구조 데이터. 이 출력이
 * 카드뉴스 레이아웃 컴포지터(analyze/transform)의 입력으로 바로 연결된다.
 */

import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import { extractStructured, type ExtractMode, type UpstageFile } from './upstage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

export function hasOpenAIKey(): boolean {
  const k = process.env.OPENAI_API_KEY;
  return !!k && k !== 'dummy_key' && k !== 'your_openai_api_key_here';
}

export interface CardBrief {
  headline: string;
  summary: string;
  key_points: string[];
  entities: { name: string; type: 'person' | 'org' | 'product' | 'place' | 'event' | 'other' }[];
  tone: 'informative' | 'promotional' | 'casual' | 'urgent' | 'educational';
  slides: { role: 'cover' | 'point' | 'cta'; title: string; body: string }[];
  source?: { url?: string; title?: string };
}

/** JSON Schema — OpenAI structured outputs(strict)로 추출 형식을 강제한다. */
const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary', 'key_points', 'entities', 'tone', 'slides'],
  properties: {
    headline: { type: 'string', description: '8~24자 한국어 후킹 헤드라인' },
    summary: { type: 'string', description: '2~3문장 핵심 요약' },
    key_points: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: { type: 'string' },
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['person', 'org', 'product', 'place', 'event', 'other'] },
        },
      },
    },
    tone: { type: 'string', enum: ['informative', 'promotional', 'casual', 'urgent', 'educational'] },
    slides: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'title', 'body'],
        properties: {
          role: { type: 'string', enum: ['cover', 'point', 'cta'] },
          title: { type: 'string' },
          body: { type: 'string' },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `너는 한국어 카드뉴스 기획 어시스턴트다.
입력된 기사/텍스트에서 카드뉴스 제작에 필요한 정보를 추출해 구조화한다.
- headline: 모바일에서 시선을 끄는 짧은 한국어 제목
- key_points: 사실 기반의 핵심 포인트만 (추측 금지)
- entities: 본문에 실제 등장한 고유명사만
- slides: 첫 장 role=cover, 마지막 장 role=cta, 나머지 role=point
출력은 제공된 JSON 스키마를 100% 준수한다.`;

/** 1) load — URL이면 본문/타이틀 추출, 아니면 원문 반환 */
export async function loadSource(input: string): Promise<{ text: string; title?: string; url?: string }> {
  const isUrl = /^https?:\/\//i.test(input.trim());
  if (!isUrl) return { text: input };

  const url = input.trim();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CardNewsBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`source fetch failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  $('script, style, noscript, nav, footer, header, aside, iframe').remove();
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').first().text() ||
    undefined;

  // 본문 후보: article > main > body 순. 문단 위주로 모은다.
  const scope = $('article').length ? $('article') : $('main').length ? $('main') : $('body');
  const text = scope
    .find('p, h1, h2, h3, li')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .join('\n');

  return { text: text || $('body').text(), title, url };
}

/** 2) clean — 공백 정규화 + 길이 제한 */
export function cleanText(raw: string, maxChars = 6000): string {
  const cleaned = raw
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) + '…' : cleaned;
}

/** 3) extract — structured outputs로 IE 수행 */
export async function extractBrief(text: string): Promise<CardBrief> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'card_brief', strict: true, schema: BRIEF_SCHEMA as unknown as Record<string, unknown> },
    },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('empty extraction');
  return JSON.parse(content) as CardBrief;
}

/** 4) verify — cover/cta 역할 정합성 보정 */
export function verifyBrief(brief: CardBrief): CardBrief {
  const slides = [...brief.slides];
  if (slides.length > 0) {
    slides[0] = { ...slides[0], role: 'cover' };
    slides[slides.length - 1] = { ...slides[slides.length - 1], role: 'cta' };
    for (let i = 1; i < slides.length - 1; i++) slides[i] = { ...slides[i], role: 'point' };
  }
  return { ...brief, slides };
}

/** 전체 파이프라인 실행 */
export async function runExtraction(input: string): Promise<CardBrief> {
  const { text, title, url } = await loadSource(input);
  const cleaned = cleanText(text);
  if (cleaned.length < 20) throw new Error('insufficient source text');
  const brief = await extractBrief(cleaned);
  const verified = verifyBrief(brief);
  return { ...verified, source: { url, title } };
}

/**
 * 문서/이미지(스펙시트·보도자료·스크린샷·PDF) → CardBrief 파이프라인.
 *
 * Upstage Universal IE 를 프런트엔드로 써서 문서를 구조화 데이터로 만든 뒤,
 * 그 데이터를 텍스트로 직렬화해 기존 OpenAI 카피라이팅 단계(extractBrief)에
 * 그대로 흘려보낸다. 즉 Upstage = 문서 이해, OpenAI = 카드뉴스 기획.
 *
 *   1) Upstage   — 자동 생성 스키마로 구조화 필드 추출 (기본 async)
 *   2) serialize — 추출 필드를 사람이 읽는 텍스트로 평탄화
 *   3) extract   — 기존 structured-outputs 카피라이터로 CardBrief 작성
 *   4) verify    — cover/cta 역할 정합성 보정
 */
export async function runDocumentExtraction(
  file: UpstageFile,
  opts: { mode?: ExtractMode } = {},
): Promise<CardBrief> {
  const { data } = await extractStructured(file, { mode: opts.mode });
  const serialized = serializeStructured(data);
  const cleaned = cleanText(serialized);
  if (cleaned.length < 20) throw new Error('문서에서 추출된 내용이 부족합니다');
  const brief = await extractBrief(cleaned);
  const verified = verifyBrief(brief);
  return { ...verified, source: { title: file.filename } };
}

/** 추출된 구조화 필드를 "key: value" 라인들로 평탄화 (LLM 입력용). */
export function serializeStructured(data: Record<string, unknown>, prefix = ''): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v && typeof v === 'object') {
          lines.push(serializeStructured(v as Record<string, unknown>, `${label}[${i}]`));
        } else {
          lines.push(`${label}[${i}]: ${String(v)}`);
        }
      });
    } else if (typeof value === 'object') {
      lines.push(serializeStructured(value as Record<string, unknown>, label));
    } else {
      lines.push(`${label}: ${String(value)}`);
    }
  }
  return lines.filter(Boolean).join('\n');
}
