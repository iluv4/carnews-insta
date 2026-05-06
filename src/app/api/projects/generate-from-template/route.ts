import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { GenerationInput, SlideContent, TemplateJSON, SlideRole } from '@/lib/types';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

/**
 * POST /api/projects/generate-from-template
 * 템플릿 + 주제 입력으로 Project를 생성하고 슬라이드별 카피를 기획합니다.
 *
 * Body: GenerationInput
 * Returns: { projectId, status, slides }
 */
export async function POST(req: Request) {
  try {
    const input: GenerationInput = await req.json();
    const { templateId, brandId, topic, businessType, goal, target, offer, clientContext, slideCount = 5 } = input;

    if (!templateId || !topic) {
      return NextResponse.json({ error: 'templateId and topic are required' }, { status: 400 });
    }

    let session = null;
    try { session = await getServerSession(authOptions); } catch {}

    // 1) Load template
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const templateJson = template.templateJson as unknown as TemplateJSON | null;
    const recommendedCount = templateJson?.rules?.recommended_slide_count ?? slideCount;
    const actualSlideCount = Math.min(slideCount, recommendedCount, 8);

    // 2) Plan slide copy with GPT
    const slides = await planSlideCopy({
      topic, businessType, goal, target, offer, clientContext,
      slideCount: actualSlideCount,
      templateJson,
    });

    // 3) Create Project + ProjectSlides in DB
    const project = await prisma.project.create({
      data: {
        templateId,
        brandId: brandId ?? null,
        title: topic,
        status: 'planning',
        inputJson: input as any,
        userId: session?.user ? (session.user as any).id : null,
        slides: {
          create: slides.map(slide => ({
            slideNo: slide.slideNo,
            role: slide.role,
            contentJson: slide as any,
            status: 'pending',
          })),
        },
      },
      include: { slides: { orderBy: { slideNo: 'asc' } } },
    });

    await prisma.project.update({ where: { id: project.id }, data: { status: 'draft' } });

    return NextResponse.json({
      projectId: project.id,
      status: project.status,
      slideCount: project.slides.length,
      slides: project.slides.map(s => ({
        id: s.id,
        slideNo: s.slideNo,
        role: s.role,
        content: s.contentJson,
        status: s.status,
      })),
    });

  } catch (error: any) {
    console.error('[projects/generate-from-template]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function planSlideCopy({
  topic, businessType, goal, target, offer, clientContext,
  slideCount, templateJson,
}: {
  topic: string; businessType?: string; goal?: string; target?: string;
  offer?: string; clientContext?: string; slideCount: number;
  templateJson: TemplateJSON | null;
}): Promise<SlideContent[]> {

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key' || apiKey === 'your_openai_api_key_here') {
    return mockSlides(topic, slideCount);
  }

  const slideRoles = templateJson?.slides?.slice(0, slideCount).map(s => s.role)
    ?? defaultRoles(slideCount);

  const prompt = `당신은 한국 SNS 카드뉴스 카피라이터입니다.
다음 정보를 바탕으로 인스타그램 카드뉴스 ${slideCount}장의 카피를 작성해주세요.

주제: ${topic}
업종: ${businessType ?? '일반'}
목표: ${goal ?? '인지도 상승'}
타겟: ${target ?? '일반 소비자'}
특별 혜택/오퍼: ${offer ?? '없음'}
${clientContext ? `추가 정보:\n${clientContext}` : ''}

슬라이드 역할 순서: ${slideRoles.join(' → ')}

각 슬라이드에 대해 아래 JSON 형식으로 응답하세요 (JSON 배열, 마크다운 없이):
[
  {
    "slideNo": 1,
    "role": "cover",
    "headline": "굵고 짧은 제목 (15자 이내)",
    "subcopy": "부제 한 줄 (25자 이내)",
    "body": null,
    "items": null,
    "cta": null,
    "imagePrompt": "배경 이미지 생성용 영어 프롬프트 (텍스트 없이 배경/분위기만)"
  }
]

규칙:
- headline은 임팩트 있게, 한글 15자 이내
- imagePrompt는 영어로, 텍스트/글자가 없는 순수 배경/비주얼 묘사
- tip/info 슬라이드는 items 배열에 3~5개 항목
- cta 슬라이드는 cta 필드에 행동 유도 문구
- JSON 배열만 반환, 설명 없음`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '당신은 한국 SNS 마케팅 카피라이터입니다. JSON만 반환합니다.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const raw = res.choices[0].message.content || '{"slides":[]}';
    const parsed = JSON.parse(raw);
    const slidesArr: SlideContent[] = Array.isArray(parsed) ? parsed : (parsed.slides ?? []);

    // Ensure correct slideNo
    return slidesArr.slice(0, slideCount).map((s, i) => ({ ...s, slideNo: i + 1 }));
  } catch (e) {
    console.error('[planSlideCopy] GPT error:', e);
    return mockSlides(topic, slideCount);
  }
}

function defaultRoles(count: number): SlideRole[] {
  const all: SlideRole[] = ['cover', 'intro', 'problem', 'solution', 'tip', 'offer', 'cta'];
  return all.slice(0, count);
}

function mockSlides(topic: string, count: number): SlideContent[] {
  const roles = defaultRoles(count);
  return roles.map((role, i) => ({
    slideNo: i + 1,
    role,
    headline: i === 0 ? topic : `${topic} ${i + 1}번 슬라이드`,
    subcopy: '지금 바로 확인하세요',
    body: null,
    items: role === 'tip' ? ['포인트 1', '포인트 2', '포인트 3'] : null,
    cta: role === 'cta' ? '프로필 링크 방문 ↗' : null,
    imagePrompt: `${topic} themed background, Korean aesthetic, no text, clean minimal`,
  }));
}
