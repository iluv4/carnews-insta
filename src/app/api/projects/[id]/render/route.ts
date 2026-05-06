import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]/render
 * 프로젝트의 editableJson 목록을 반환합니다.
 * 클라이언트 CanvasEditor가 이 JSON을 읽어 최종 렌더링합니다.
 *
 * PATCH /api/projects/[id]/render
 * Body: { slides: [{ slideId, editableJson }] }
 * 사용자가 수정한 editableJson을 저장합니다.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { slides: { orderBy: { slideNo: 'asc' } } },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    return NextResponse.json({
      projectId: project.id,
      title: project.title,
      status: project.status,
      slides: project.slides.map(s => ({
        id: s.id,
        slideNo: s.slideNo,
        role: s.role,
        contentJson: s.contentJson,
        editableJson: s.editableJson,
        generatedBgUrl: s.generatedBgUrl,
        finalImageUrl: s.finalImageUrl,
        status: s.status,
      })),
    });

  } catch (error: any) {
    console.error('[projects/[id]/render GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { slides } = await req.json();

    if (!Array.isArray(slides)) {
      return NextResponse.json({ error: 'slides array required' }, { status: 400 });
    }

    await Promise.all(
      slides.map(({ slideId, editableJson, finalImageUrl }: any) =>
        prisma.projectSlide.update({
          where: { id: slideId },
          data: {
            ...(editableJson !== undefined ? { editableJson } : {}),
            ...(finalImageUrl !== undefined ? { finalImageUrl } : {}),
          },
        })
      )
    );

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[projects/[id]/render PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
