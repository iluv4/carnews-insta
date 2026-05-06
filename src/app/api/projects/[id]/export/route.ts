import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]/export
 * 생성된 슬라이드 URL 목록을 반환합니다.
 * 실제 ZIP/PDF 변환은 클라이언트 사이드에서 처리합니다.
 *
 * Query: ?format=json (default) | ?format=urls
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') ?? 'json';

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        slides: { orderBy: { slideNo: 'asc' } },
        template: { select: { name: true, category: true } },
      },
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const slideData = project.slides.map(s => ({
      slideNo: s.slideNo,
      role: s.role,
      finalImageUrl: s.finalImageUrl ?? s.generatedBgUrl,
      editableJson: s.editableJson,
      status: s.status,
    }));

    if (format === 'urls') {
      const urls = slideData.map(s => s.finalImageUrl).filter(Boolean);
      return NextResponse.json({ projectId: id, urls });
    }

    return NextResponse.json({
      projectId: id,
      title: project.title,
      template: project.template,
      slideCount: project.slides.length,
      slides: slideData,
      exportedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[projects/[id]/export]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
