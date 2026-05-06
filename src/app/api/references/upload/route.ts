import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { ReferenceImage } from '@/lib/types';

/**
 * POST /api/references/upload
 * 직접 업로드한 base64 이미지 배열을 Reference DB에 저장합니다.
 * /api/references/from-instagram의 fallback 경로.
 *
 * Body: { images: string[] }  (base64 data URLs)
 * Returns: { referenceId, images, status }
 */
export async function POST(req: Request) {
  try {
    const { images: base64Images, sourceUrl } = await req.json();

    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      return NextResponse.json({ error: 'images 배열이 필요합니다.' }, { status: 400 });
    }

    let session = null;
    try { session = await getServerSession(authOptions); } catch {}

    const images: ReferenceImage[] = base64Images.slice(0, 12).map((b64, i) => ({
      id: `img_${i + 1}`,
      url: b64,        // base64 data URL
      base64: b64,
    }));

    const reference = await prisma.reference.create({
      data: {
        sourceType: 'upload',
        sourceUrl: sourceUrl ?? null,
        status: 'fetched',
        imagesJson: images as any,
        userId: session?.user ? (session.user as any).id : null,
      },
    });

    return NextResponse.json({
      referenceId: reference.id,
      images,
      status: reference.status,
    });

  } catch (error: any) {
    console.error('[references/upload]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
