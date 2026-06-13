import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  buildFabricSpec,
  fallbackLayout,
  CardCopy,
  LayoutTemplate,
  SubjectBrief,
  SlideRole,
} from '@/lib/fabricSpec';
import { MODELS, chatTuning } from '@/lib/models';

// Fast path: NO image generation, NO headless Chromium.
// The model returns structured copy; buildFabricSpec emits a declarative spec
// that the client (CardCanvas / Fabric.js) renders to PNG. Server does zero
// pixel work — E2E drops from tens-of-seconds (diffusion/Chromium) to ~2-5s.
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

function hasKey(): boolean {
  const k = process.env.OPENAI_API_KEY;
  return !!k && k !== 'dummy_key' && k !== 'your_openai_api_key_here';
}

function safeParseJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

function parseLayout(raw: unknown, fallbackSlideCount = 3): LayoutTemplate {
  if (typeof raw === 'string') {
    const parsed = safeParseJson<LayoutTemplate>(raw);
    if (parsed && parsed.type === 'layout' && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      return parsed;
    }
  } else if (raw && typeof raw === 'object' && (raw as LayoutTemplate).type === 'layout') {
    return raw as LayoutTemplate;
  }
  // Legacy "Design DNA JSONL" templates are not LayoutTemplates → graceful default.
  return fallbackLayout(fallbackSlideCount);
}

const FALLBACK_COPY: CardCopy = {
  title: '오늘의 한 끼, 진심을 담았어요',
  subtitle: '계절 재료로 차린 정갈한 상',
  bullets: ['😍 보기만 해도 군침', '😎 한입에 매료', '🤤 자꾸 손이 가요'],
  footer: '계정 팔로우하고 매일 만나요',
  brand: '',
};

const SOURCE_PROMPT = `Analyse this Korean restaurant/product photo for a card-news caption.
Return STRICT JSON only:
{"subject":"한국어 짧은 명칭","ingredients":["..."],"mood":"clean|moody|warm|cozy|vivid","focal_zone":"center|left|right|top|bottom","brand_hint":"?"}`;

// Subject is a property of the PHOTO, not the slide — analyse ONCE and reuse for
// every slide. (The old pipeline re-ran vision per slide → Nx cost + rate limits.)
async function analyseSubject(photoB64: string): Promise<SubjectBrief> {
  const fallback: SubjectBrief = { subject: '메뉴', ingredients: [], mood: 'warm', focal_zone: 'center' };
  if (!hasKey() || !photoB64) return fallback;
  try {
    const res = await openai.chat.completions.create({
      model: MODELS.vision,
      response_format: { type: 'json_object' },
      // Short structured brief; 'low' effort keeps this fast since it runs once
      // per request and gates every slide's copy.
      ...chatTuning(MODELS.vision, { maxOutputTokens: 220, reasoningEffort: 'low' }),
      messages: [
        { role: 'system', content: 'You output ONLY JSON. No markdown.' },
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: SOURCE_PROMPT },
            { type: 'image_url' as const, image_url: { url: photoB64 } },
          ],
        },
      ],
    });
    const parsed = safeParseJson<SubjectBrief>(res.choices[0].message.content ?? '');
    if (parsed && parsed.subject) return parsed;
  } catch (err) {
    console.warn('[transform] subject vision failed:', (err as Error).message);
  }
  return fallback;
}

function copyPrompt(opts: {
  layout: LayoutTemplate;
  subject: SubjectBrief;
  slideIndex: number;
  theme?: string;
  clientContext?: string;
}): string {
  const slide = opts.layout.slides[opts.slideIndex] ?? opts.layout.slides[opts.layout.slides.length - 1];
  const role: SlideRole = slide.role;
  const emojis = slide.body.emojis?.slice(0, 3) ?? ['😍', '😎', '🤤'];
  const ingredients = opts.subject.ingredients?.slice(0, 6).join(', ') || '';
  const guides: Record<SlideRole, string> = {
    cover: '훅 헤드라인 + 1줄 부제. bullets 비움.',
    review: '훅 헤드라인 + 이모지 불릿 3개(고객 후기 톤). footer 짧은 한 줄.',
    menu: '메뉴 카테고리 헤드라인 + 본문 2~3줄. footer 비움.',
    cta: '강한 후크 헤드라인 + 부제. bullets 비움.',
    info: '정보 헤드라인 + 본문 2줄.',
    closing: '마무리 한 줄 + footer를 화살표 CTA로.',
  };
  return `너는 한국어 인스타그램 카드뉴스 카피라이터다.
- 자연스러운 한국어. 광고 톤이지만 과장·이모지 남발 금지.
- 슬라이드 역할: ${role}
- 가이드: ${guides[role]}

피사체: ${opts.subject.subject}
재료/구성: ${ingredients}
무드: ${opts.subject.mood ?? 'warm'}
사용자 입력 주제: ${opts.theme ?? ''}
업체 정보: ${opts.clientContext ?? ''}

JSON만 출력:
{"title":"헤드라인 (12~22자)","subtitle":"부제 (8~18자) 또는 빈 문자열","bullets":["${emojis[0]} ...","${emojis[1]} ...","${emojis[2]} ..."],"footer":"한 줄 (8~22자) 또는 빈 문자열","brand":"브랜드 텍스트 또는 빈 문자열"}

규칙:
- bullets는 ${slide.body.style === 'emoji-bullet' ? '반드시 3줄' : '비워도 됨([])'}.
- 사실에 없는 메뉴·가격 만들지 말 것.`;
}

async function generateCopy(opts: {
  layout: LayoutTemplate;
  subject: SubjectBrief;
  slideIndex: number;
  theme?: string;
  clientContext?: string;
}): Promise<CardCopy> {
  if (!hasKey()) return FALLBACK_COPY;
  try {
    const res = await openai.chat.completions.create({
      model: MODELS.copy,
      response_format: { type: 'json_object' },
      ...chatTuning(MODELS.copy, { maxOutputTokens: 400, temperature: 0.8 }),
      messages: [
        { role: 'system', content: 'You output ONLY JSON. No markdown.' },
        { role: 'user', content: copyPrompt(opts) },
      ],
    });
    const parsed = safeParseJson<CardCopy>(res.choices[0].message.content ?? '');
    if (parsed && parsed.title) return parsed;
  } catch (err) {
    console.warn('[transform] copy gen failed:', (err as Error).message);
  }
  return FALLBACK_COPY;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const { jsonlAnalysis, theme, referenceImageBase64, sourceImages, clientContext } = body as {
      jsonlAnalysis?: string;
      theme?: string;
      referenceImageBase64?: string;
      sourceImages?: string[];
      clientContext?: string;
    };

    if (!jsonlAnalysis) {
      return NextResponse.json({ error: 'jsonlAnalysis (layout) required' }, { status: 400 });
    }

    const layout = parseLayout(jsonlAnalysis);
    const slideCount = layout.slides.length;
    const photos: string[] = (sourceImages && sourceImages.length > 0)
      ? sourceImages
      : (referenceImageBase64 ? [referenceImageBase64] : []);

    // One vision call shared across all slides (not one per slide).
    const subject = await analyseSubject(photos[0] ?? '');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        await Promise.allSettled(
          layout.slides.map(async (_slide, i) => {
            try {
              const photo = photos[i] ?? photos[photos.length - 1] ?? '';
              const copy = await generateCopy({ layout, subject, slideIndex: i, theme, clientContext });
              const spec = buildFabricSpec(layout, i, photo, copy);
              send({ index: i, fabricSpec: spec, copy });
            } catch (err) {
              send({ index: i, error: (err as Error).message });
            }
          })
        );

        send({ done: true, slides: slideCount, ms: Date.now() - t0 });
        console.log(`[transform] ${slideCount} slides in ${Date.now() - t0}ms`);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    const detail =
      (error as { error?: { message?: string }; message?: string })?.error?.message ||
      (error as Error)?.message ||
      String(error);
    console.error('[transform] route error:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
