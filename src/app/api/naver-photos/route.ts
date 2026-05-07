import { NextResponse } from 'next/server';

export const maxDuration = 30;

const UA = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// naver.me/xxx 또는 map.naver.com/.../place/12345 에서 placeId 추출
async function placeIdFromUrl(input: string): Promise<string | null> {
  const direct = input.match(/place\/(\d+)/);
  if (direct) return direct[1];

  try {
    const res = await fetch(input, {
      redirect: 'follow',
      headers: { 'User-Agent': UA },
    });
    const m = res.url.match(/place\/(\d+)/);
    if (m) return m[1];
  } catch { /* ignore */ }

  return null;
}

// Naver bff-gateway GraphQL — 인증 없이 placeDetail.images 접근 가능
async function fetchPhotosByPlaceId(placeId: string): Promise<string[]> {
  const res = await fetch('https://bff-gateway.place.naver.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Referer': `https://m.place.naver.com/place/${placeId}/photo`,
      'Origin': 'https://m.place.naver.com',
    },
    body: JSON.stringify({
      query: `{
        placeDetail(id: "${placeId}", deviceType: MOBILE) {
          images {
            images { origin width height }
            total
          }
        }
      }`,
    }),
  });

  if (!res.ok) throw new Error(`GraphQL 요청 실패 (${res.status})`);

  const json = await res.json();
  const images: Array<{ origin: string }> = json?.data?.placeDetail?.images?.images ?? [];

  return images
    .map(img => img.origin)
    .filter(u => u && u.length > 20)
    .slice(0, 12);
}

// 이름 검색으로 placeId 찾기
async function getPlaceIdByName(businessName: string): Promise<string> {
  const res = await fetch(
    `https://map.naver.com/v5/api/search?caller=mnd&query=${encodeURIComponent(businessName)}&type=place&page=1&displayCount=1&lang=ko`,
    {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://map.naver.com/',
        'Accept': 'application/json',
      },
    }
  );

  if (res.ok) {
    const data = await res.json();
    const id = data?.result?.place?.list?.[0]?.id;
    if (id) return id;
  }

  // fallback: bff-gateway searchPlace GraphQL
  const gqlRes = await fetch('https://bff-gateway.place.naver.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Referer': 'https://m.place.naver.com/',
      'Origin': 'https://m.place.naver.com',
    },
    body: JSON.stringify({
      query: `{
        search(query: "${businessName}", displayCount: 1) {
          businesses {
            items { id name }
          }
        }
      }`,
    }),
  });

  if (gqlRes.ok) {
    const gqlData = await gqlRes.json();
    const id = gqlData?.data?.search?.businesses?.items?.[0]?.id;
    if (id) return id;
  }

  throw new Error(`"${businessName}" 검색 결과를 찾을 수 없습니다. 네이버 지도 URL을 직접 붙여넣어 주세요.`);
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

    const photos = await fetchPhotosByPlaceId(placeId);

    if (photos.length === 0) {
      return NextResponse.json(
        { error: '사진을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ photos, count: photos.length, placeId });
  } catch (err: any) {
    console.error('[naver-photos]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
