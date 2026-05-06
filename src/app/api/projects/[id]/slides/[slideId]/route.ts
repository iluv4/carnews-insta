import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]/slides/[slideId]
 * 단일 슬라이드 조회 (editableJson 포함)
 *
 * PATCH /api/projects/[id]/slides/[slideId]
 * Body: { editableJson?, finalImageUrl?, contentJson? }
 * CanvasEditor에서 수정한 레이어 구조를 저장합니다.
 */

type Params = { params: Promise<{ id: string; slideId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { slideId } = await params;
    const slide = await prisma.projectSlide.findUnique({ where: { id: slideId } });
    if (!slide) return NextResponse.json({ error: 'Slide not found' }, { status: 404 });

    return NextResponse.json({
      id: slide.id,
      slideNo: slide.slideNo,
      role: slide.role,
      contentJson: slide.contentJson,
      editableJson: slide.editableJson,
      generatedBgUrl: slide.generatedBgUrl,
      finalImageUrl: slide.finalImageUrl,
      status: slide.status,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { slideId } = await params;
    const body = await req.json();

    const updateData: Record<string, any> = {};
    if (body.editableJson !== undefined) updateData.editableJson = body.editableJson;
    if (body.finalImageUrl !== undefined) updateData.finalImageUrl = body.finalImageUrl;
    if (body.contentJson !== undefined) updateData.contentJson = body.contentJson;
    if (body.generatedBgUrl !== undefined) updateData.generatedBgUrl = body.generatedBgUrl;
    if (body.status !== undefined) updateData.status = body.status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '변경할 필드가 없습니다.' }, { status: 400 });
    }

    const updated = await prisma.projectSlide.update({
      where: { id: slideId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      editableJson: updated.editableJson,
      finalImageUrl: updated.finalImageUrl,
      status: updated.status,
    });
  } catch (error: any) {
    console.error('[projects/[id]/slides/[slideId] PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
