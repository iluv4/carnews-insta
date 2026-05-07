import { NextResponse } from 'next/server';

export const maxDuration = 30;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': 'https://map.naver.com/',
};

// naver.me/xxx  또는  map.naver.com/.../place/12345  에서 placeId 추출
async function placeIdFromUrl(input: string): Promise<string | null> {
  // map.naver.com URL에서 바로 추출
  const directMatch = input.match(/place\/(\d+)/);
  if (directMatch) return directMatch[1];

  // naver.me 단축 URL → 리다이렉트 따라가서 최종 URL에서 추출
  if (input.includes('naver.me') || input.includes('naver.com')) {
    try {
      const res = await fetch(input, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
      });
      const finalUrl = res.url;
      const m = finalUrl.match(/place\/(\d+)/);
      if (m) return m[1];
    } catch {
      // HEAD 안 되면 GET으로 재시도
      const res = await fetch(input, {
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
      });
      const m = res.url.match(/place\/(\d+)/);
      if (m) return m[1];
    }
  }

  return null;
}

async function getPlaceIdByName(businessName: string): Promise<string> {
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
      return NextResponse.json({ error: '가게 이름 또는 네이버 지도 URL을 입력해주세요.' }, { status: 400 });
    }

    const input = businessName.trim();

    // URL이면 placeId 직접 추출, 아니면 이름으로 검색
    const isUrl = input.startsWith('http') || input.includes('naver.me');
    let placeId: string;

    if (isUrl) {
      const id = await placeIdFromUrl(input);
      if (!id) throw new Error('URL에서 장소를 찾을 수 없습니다.');
      placeId = id;
    } else {
      placeId = await getPlaceIdByName(input);
    }

    const photos = await fetchPhotoUrls(placeId);

    if (photos.length === 0) {
      return NextResponse.json(
        { error: '사진을 찾을 수 없습니다. 정확한 가게 이름이나 URL을 입력해주세요.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ photos, count: photos.length, placeId });
  } catch (err: any) {
    console.error('[naver-photos]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
