import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { ReferenceImage } from '@/lib/types';

/**
 * POST /api/references/from-instagram
 * 인스타그램 URL에서 이미지를 가져와 Reference DB에 저장합니다.
 *
 * Body: { url: string }
 * Returns: { referenceId, images, status }
 */
export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    let session = null;
    try { session = await getServerSession(authOptions); } catch {}

    // 1) 내부 /api/instagram 으로 이미지 URL 목록 가져오기
    const origin = new URL(req.url).origin;
    const instaRes = await fetch(`${origin}/api/instagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!instaRes.ok) {
      const err = await instaRes.json().catch(() => ({ error: 'Instagram fetch failed' }));
      return NextResponse.json({ error: err.error || 'Instagram fetch failed' }, { status: 502 });
    }

    const { images: imageUrls }: { images: string[] } = await instaRes.json();
    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json({ error: '이미지를 가져오지 못했습니다. 공개 게시물인지 확인하세요.' }, { status: 422 });
    }

    // 2) ReferenceImage 배열 구성
    const images: ReferenceImage[] = imageUrls.slice(0, 12).map((imgUrl, i) => ({
      id: `img_${i + 1}`,
      url: imgUrl,
    }));

    // 3) DB에 저장
    const normalised = url.trim().replace(/\/+$/, '').split('?')[0].toLowerCase();
    const reference = await prisma.reference.create({
      data: {
        sourceType: 'instagram_url',
        sourceUrl: normalised,
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
    console.error('[references/from-instagram]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
