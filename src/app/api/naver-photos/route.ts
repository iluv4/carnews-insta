import { NextResponse } from 'next/server';

export const maxDuration = 30;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://map.naver.com/',
  'Origin': 'https://map.naver.com',
};

// 1단계: 장소명으로 placeId 검색
async function searchPlaceId(query: string): Promise<string | null> {
  const url = `https://map.naver.com/v5/api/search?query=${encodeURIComponent(query)}&type=all&searchCoord=&boundary=`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`네이버 검색 실패: ${res.status}`);

  const data = await res.json();

  // place 결과에서 첫 번째 id 추출
  const places =
    data?.result?.place?.list ||
    data?.result?.business?.list ||
    [];

  if (places.length === 0) return null;
  return places[0].id || places[0].placeId || null;
}

// 2단계: placeId로 사진 목록 가져오기
async function fetchPlacePhotos(placeId: string): Promise<string[]> {
  const images: string[] = [];

  // 방법 A: place summary API
  try {
    const summaryUrl = `https://place.map.naver.com/place/api/summary?businessId=${placeId}`;
    const res = await fetch(summaryUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      const photos: any[] =
        data?.photos ||
        data?.result?.photos ||
        data?.data?.photos ||
        [];
      photos.forEach((p: any) => {
        const url = p.url || p.photoUrl || p.src;
        if (url) images.push(url);
      });
    }
  } catch {}

  // 방법 B: 사진 전용 엔드포인트
  if (images.length === 0) {
    try {
      const photoUrl = `https://place.map.naver.com/place/api/lv1/place/${placeId}/photos?page=1&size=30`;
      const res = await fetch(photoUrl, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const list: any[] = data?.photos || data?.data || data?.result || [];
        list.forEach((p: any) => {
          const url = p.url || p.photoUrl || p.orgUrl;
          if (url) images.push(url);
        });
      }
    } catch {}
  }

  // 방법 C: place lv1 전체 데이터에서 추출
  if (images.length === 0) {
    try {
      const detailUrl = `https://place.map.naver.com/place/api/lv1/place/${placeId}`;
      const res = await fetch(detailUrl, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const rawPhotos: any[] =
          data?.photos ||
          data?.result?.photos ||
          data?.data?.photos ||
          [];
        rawPhotos.forEach((p: any) => {
          const url = p.url || p.photoUrl || p.orgUrl;
          if (url) images.push(url);
        });

        // 썸네일 fallback
        if (images.length === 0) {
          const thumb = data?.thumbnail || data?.result?.thumbnail;
          if (thumb) images.push(thumb);
        }
      }
    } catch {}
  }

  return [...new Set(images)]; // 중복 제거
}

// 3단계: 이미지 URL을 프록시 가능한 형태로 정제
function cleanImageUrl(url: string): string {
  // 네이버 사진 URL 고화질 파라미터로 변환
  if (url.includes('pstatic.net') || url.includes('naver.net')) {
    return url.replace(/\/\d+x\d+\//, '/').replace(/\?.*$/, '');
  }
  return url;
}

export async function POST(req: Request) {
  try {
    const { query, placeId: directPlaceId } = await req.json();

    if (!query && !directPlaceId) {
      return NextResponse.json({ error: '장소명(query) 또는 placeId가 필요합니다.' }, { status: 400 });
    }

    // placeId 확보
    let placeId = directPlaceId;
    if (!placeId) {
      console.log(`[naver-photos] 검색: ${query}`);
      placeId = await searchPlaceId(query);
      if (!placeId) {
        return NextResponse.json({ error: `"${query}" 검색 결과가 없습니다.` }, { status: 404 });
      }
      console.log(`[naver-photos] placeId: ${placeId}`);
    }

    // 사진 가져오기
    const rawImages = await fetchPlacePhotos(placeId);
    const images = rawImages.map(cleanImageUrl).slice(0, 30);

    console.log(`[naver-photos] ${images.length}장 수집`);

    if (images.length === 0) {
      return NextResponse.json({
        error: '사진을 찾지 못했습니다. 네이버 플레이스 API 구조가 변경됐을 수 있습니다.',
        placeId,
        debug: { tried: ['summary', 'photos', 'lv1'] },
      }, { status: 404 });
    }

    return NextResponse.json({ images, placeId, count: images.length });

  } catch (err: any) {
    console.error('[naver-photos]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
