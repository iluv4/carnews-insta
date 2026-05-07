import { NextResponse } from 'next/server';

export const maxDuration = 30;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': 'https://m.map.naver.com/',
};

// naver.me/xxx  또는  map.naver.com/.../place/12345  에서 placeId 추출
async function placeIdFromUrl(input: string): Promise<string | null> {
  const directMatch = input.match(/place\/(\d+)/);
  if (directMatch) return directMatch[1];

  // naver.me 단축 URL → 리다이렉트 따라가기
  try {
    const res = await fetch(input, {
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
    });
    const m = res.url.match(/place\/(\d+)/);
    if (m) return m[1];
  } catch { /* ignore */ }

  return null;
}

async function getPlaceIdByName(businessName: string): Promise<string> {
  // m.place.naver.com 검색으로 placeId 추출
  const searchUrl = `https://m.place.naver.com/place/search/list?query=${encodeURIComponent(businessName)}`;
  const res = await fetch(searchUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`네이버 검색 실패 (${res.status})`);

  const html = await res.text();
  // 검색 결과 첫 번째 place ID 추출
  const m = html.match(/\/place\/(\d+)|"id"\s*:\s*"(\d+)"/);
  const placeId = m?.[1] ?? m?.[2];
  if (!placeId) throw new Error(`"${businessName}" 검색 결과를 찾을 수 없습니다.`);
  return placeId;
}

async function fetchPhotoUrls(placeId: string): Promise<string[]> {
  // m.place.naver.com 은 SSR로 사진 URL을 HTML에 포함 (pcmap은 SPA라 JS 필요)
  const url = `https://m.place.naver.com/place/${placeId}/photo`;
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: `https://m.map.naver.com/`,
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`사진 페이지 접근 실패 (${res.status})`);

  const html = await res.text();

  // search.pstatic.net 프록시 URL의 src= 파라미터에서 실제 ldb-phinf.pstatic.net URL 디코딩
  const srcMatches = html.match(/src=https?%3A%2F%2Fldb-phinf\.pstatic\.net%2F[^&"'\s>]+/g) ?? [];
  const decoded = srcMatches
    .map(m => decodeURIComponent(m.replace(/^src=/, '')))
    .filter(u => u.length > 60);

  if (decoded.length > 0) {
    return [...new Set(decoded)].slice(0, 12);
  }

  // fallback: search.pstatic.net URL 자체를 사용 (고화질 리사이즈 버전)
  const fallback = html.match(/https:\/\/search\.pstatic\.net\/common\/[^"'\s>]+ldb-phinf[^"'\s>]+/g) ?? [];
  return [...new Set(fallback)].slice(0, 12);
}

export async function POST(req: Request) {
  try {
    const { businessName } = await req.json();
    if (!businessName?.trim()) {
      return NextResponse.json({ error: '가게 이름 또는 네이버 지도 URL을 입력해주세요.' }, { status: 400 });
    }

    const input = businessName.trim();
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
