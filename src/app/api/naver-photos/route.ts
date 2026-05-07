import { NextResponse } from 'next/server';

export const maxDuration = 30;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': 'https://map.naver.com/',
};

async function getPlaceId(businessName: string): Promise<string> {
  const url = `https://map.naver.com/v5/api/search?caller=mnd&query=${encodeURIComponent(businessName)}&type=all&page=1&displayCount=3&lang=ko`;
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`네이버 검색 실패 (${res.status})`);

  const data = await res.json();
  const placeId = data?.result?.place?.list?.[0]?.id;
  if (!placeId) throw new Error(`"${businessName}" 검색 결과를 찾을 수 없습니다.`);
  return placeId;
}

async function fetchPhotoUrls(placeId: string): Promise<string[]> {
  const url = `https://pcmap.place.naver.com/place/${placeId}/photo`;
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: `https://map.naver.com/v5/entry/place/${placeId}`,
    },
  });
  if (!res.ok) throw new Error(`사진 페이지 접근 실패 (${res.status})`);

  const html = await res.text();

  // pstatic.net 이미지 URL 추출 (중복 제거)
  const matches = html.match(/https:\/\/[^"'\s]*pstatic\.net\/[^"'\s]+/g) ?? [];
  const unique = [...new Set(matches)].filter(
    u => !u.includes('profile') && !u.includes('logo') && u.length > 60
  );
  return unique.slice(0, 12);
}

export async function POST(req: Request) {
  try {
    const { businessName } = await req.json();
    if (!businessName?.trim()) {
      return NextResponse.json({ error: '가게 이름을 입력해주세요.' }, { status: 400 });
    }

    const placeId = await getPlaceId(businessName.trim());
    const photos = await fetchPhotoUrls(placeId);

    if (photos.length === 0) {
      return NextResponse.json(
        { error: '사진을 찾을 수 없습니다. 정확한 가게 이름을 입력해주세요.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ photos, count: photos.length, placeId });
  } catch (err: any) {
    console.error('[naver-photos]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
