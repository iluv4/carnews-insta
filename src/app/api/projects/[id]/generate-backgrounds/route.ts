import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import type { SlideContent, TemplateJSON } from '@/lib/types';

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

function toImageFile(base64: string): File {
  const raw = base64.replace(/^data:image\/\w+;base64,/, '');
  const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
  const mime = (mimeMatch?.[1] || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
  return new File([Buffer.from(raw, 'base64')], 'image.png', { type: mime });
}

/**
 * POST /api/projects/[id]/generate-backgrounds
 * SSE: 슬라이드별 배경 이미지를 순서대로 생성해 스트리밍합니다.
 * gpt-image-2 사용. 텍스트 없는 배경/비주얼만 생성.
 *
 * Body: { styleTemplateBase64?: string, referenceImageBase64?: string }
 * Stream: data: { slideId, slideNo, url } / data: { done: true }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { styleTemplateBase64, referenceImageBase64 } = body;

    // 1) Load project + slides
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        slides: { orderBy: { slideNo: 'asc' } },
        template: true,
      },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const templateJson = project.template?.templateJson as unknown as TemplateJSON | null;
    const globalStyle = templateJson?.globalStyle;

    await prisma.project.update({ where: { id }, data: { status: 'generating' } });

    const encoder = new TextEncoder();
    const apiKey = process.env.OPENAI_API_KEY;
    const devMode = !apiKey || apiKey === 'dummy_key' || apiKey === 'your_openai_api_key_here';

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        await Promise.allSettled(
          project.slides.map(async (slide) => {
            const content = slide.contentJson as unknown as SlideContent;

            try {
              let imageUrl: string;

              if (devMode) {
                await new Promise(r => setTimeout(r, 600));
                imageUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop';
              } else {
                imageUrl = await generateBackground({
                  slide: content,
                  globalStyle,
                  styleTemplateBase64,
                  referenceImageBase64,
                });
              }

              // Save URL to DB
              await prisma.projectSlide.update({
                where: { id: slide.id },
                data: { generatedBgUrl: imageUrl, status: 'done' },
              });

              // Build editableJson with background layer + text zones from template
              const templateSlide = templateJson?.slides?.find(s => s.role === slide.role)
                ?? templateJson?.slides?.[slide.slideNo - 1];

              const editableJson = buildEditableJson(imageUrl, content, templateSlide, globalStyle);

              await prisma.projectSlide.update({
                where: { id: slide.id },
                data: { editableJson: editableJson as any },
              });

              send({ slideId: slide.id, slideNo: slide.slideNo, url: imageUrl });
            } catch (e: any) {
              await prisma.projectSlide.update({
                where: { id: slide.id },
                data: { status: 'failed' },
              });
              send({ slideId: slide.id, slideNo: slide.slideNo, error: e.message });
            }
          })
        );

        await prisma.project.update({ where: { id }, data: { status: 'done' } });
        send({ done: true });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error: any) {
    console.error('[projects/[id]/generate-backgrounds]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function generateBackground({
  slide,
  globalStyle,
  styleTemplateBase64,
  referenceImageBase64,
}: {
  slide: SlideContent;
  globalStyle: any;
  styleTemplateBase64?: string;
  referenceImageBase64?: string;
}): Promise<string> {
  const palette = globalStyle?.palette ?? {};
  const mood = ''; // will be inferred from imagePrompt

  // Compose image prompt — NO text in image
  const prompt = [
    slide.imagePrompt || `${slide.headline || ''} themed background`,
    `Color palette: background ${palette.background ?? '#ffffff'}, accent ${palette.accent ?? '#000000'}.`,
    'Clean Korean aesthetic. NO text, NO words, NO letters in the image.',
    'High quality photography or graphic art style.',
    slide.role === 'cover' ? 'Hero shot, dramatic lighting, full bleed.' : '',
    slide.role === 'cta' ? 'Minimal, clean, inviting.' : '',
  ].filter(Boolean).join(' ');

  // If template image provided → use edit for style continuity
  if (styleTemplateBase64 && referenceImageBase64) {
    const res = await (openai.images as any).edit({
      model: 'gpt-image-2',
      image: [toImageFile(styleTemplateBase64), toImageFile(referenceImageBase64)],
      prompt: prompt.substring(0, 32000),
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });
    const item = res.data?.[0] as any;
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) return item.url;
    throw new Error('gpt-image-2 edit 응답이 비어 있습니다.');
  }

  if (styleTemplateBase64 || referenceImageBase64) {
    const base64 = styleTemplateBase64 || referenceImageBase64!;
    const res = await (openai.images as any).edit({
      model: 'gpt-image-2',
      image: toImageFile(base64),
      prompt: prompt.substring(0, 32000),
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });
    const item = res.data?.[0] as any;
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) return item.url;
    throw new Error('gpt-image-2 edit 응답이 비어 있습니다.');
  }

  // Fallback: pure generation
  const res = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: prompt.substring(0, 32000),
    n: 1,
    size: '1024x1024',
    quality: 'high',
  } as any);
  const item = res.data?.[0] as any;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) return item.url;
  throw new Error('gpt-image-2 generate 응답이 비어 있습니다.');
}

function buildEditableJson(
  bgUrl: string,
  content: SlideContent,
  templateSlide: any,
  globalStyle: any
) {
  const W = 1080, H = 1350;
  const palette = globalStyle?.palette ?? {};
  const typo = globalStyle?.typography ?? {};
  const margin = globalStyle?.spacing?.outer_margin ?? 80;

  const layers: any[] = [
    { id: 'background', type: 'image', src: bgUrl, x: 0, y: 0, w: W, h: H, locked: true },
  ];

  // Use zone positions from template if available, otherwise use sensible defaults
  const zones = templateSlide?.zones ?? defaultZones(content.role, W, H, margin);

  for (const zone of zones) {
    if (zone.type !== 'text') continue;

    let text = '';
    if (zone.role === 'headline') text = content.headline ?? '';
    else if (zone.role === 'subcopy') text = content.subcopy ?? '';
    else if (zone.role === 'body') text = content.body ?? (content.items?.join('\n') ?? '');
    else if (zone.role === 'button') text = content.cta ?? '';

    if (!text) continue;

    layers.push({
      id: zone.id,
      type: 'text',
      text,
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
      fontFamily: 'Pretendard',
      fontSize: zone.style?.fontSize ?? (zone.role === 'headline' ? typo.headline?.estimated_size ?? 72 : typo.body?.estimated_size ?? 34),
      fontWeight: zone.style?.fontWeight ?? (zone.role === 'headline' ? typo.headline?.weight ?? 800 : typo.body?.weight ?? 400),
      color: zone.style?.color ?? palette.text ?? '#ffffff',
      lineHeight: zone.style?.lineHeight ?? 1.2,
      align: zone.style?.align ?? 'left',
    });
  }

  return { canvas: { width: W, height: H }, layers };
}

function defaultZones(role: string, W: number, H: number, margin: number) {
  const isBottomText = ['cover', 'closing', 'cta'].includes(role);
  const baseY = isBottomText ? H * 0.65 : margin;

  return [
    { id: 'headline', type: 'text', role: 'headline', x: margin, y: baseY, w: W - margin * 2, h: 180 },
    { id: 'subcopy', type: 'text', role: 'subcopy', x: margin, y: baseY + 200, w: W - margin * 2, h: 80 },
    { id: 'body', type: 'text', role: 'body', x: margin, y: baseY + 300, w: W - margin * 2, h: 300 },
    { id: 'cta', type: 'text', role: 'button', x: margin, y: H - 200, w: W - margin * 2, h: 80 },
  ];
}
