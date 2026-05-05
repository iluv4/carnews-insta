import { NextResponse } from 'next/server';
import axios from 'axios';

const RAPIDAPI_HOST = "instagram120.p.rapidapi.com";

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractUsername(url: string): string | null {
  // matches instagram.com/username or instagram.com/@username
  const match = url.match(/instagram\.com\/@?([A-Za-z0-9_.]+)\/?$/);
  return match ? match[1] : null;
}

function parseImages(data: any): string[] {
  if (Array.isArray(data)) {
    return data.map((item: any) =>
      item.url || item.pictureUrl || item.urls?.[0]?.url ||
      item.image_versions2?.candidates?.[0]?.url
    ).filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const items = data.items || data.data?.items || [data];
    return items.map((item: any) =>
      item.url || item.pictureUrl || item.urls?.[0]?.url ||
      item.image_versions2?.candidates?.[0]?.url
    ).filter(Boolean);
  }
  return [];
}

const headers = (apiKey: string) => ({
  "x-rapidapi-key": apiKey,
  "x-rapidapi-host": RAPIDAPI_HOST,
  "Content-Type": "application/json",
});

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 });
    }

    const apiKey = process.env.RAPIDAPI_KEY;

    // ── Profile URL → fetch recent posts ──────────────────────────────
    const username = extractUsername(url);
    if (username) {
      if (!apiKey || apiKey === 'your_openai_api_key_here') {
        return NextResponse.json({ error: 'RAPIDAPI_KEY required for profile fetch' }, { status: 400 });
      }

      console.log(`[instagram] fetching profile media for @${username}`);

      // Use /posts endpoint (confirmed working 2026)
      try {
        const res = await axios.post(
          `https://${RAPIDAPI_HOST}/api/instagram/posts`,
          { username },
          { headers: headers(apiKey), timeout: 15000 }
        );

        const edges: any[] = res.data?.result?.edges || [];
        const images: string[] = [];

        for (const edge of edges) {
          const node = edge.node;
          if (!node) continue;

          // carousel post
          if (node.carousel_media?.length > 0) {
            for (const slide of node.carousel_media) {
              const img = slide.image_versions2?.candidates?.[0]?.url;
              if (img) images.push(img);
            }
          } else {
            const img = node.image_versions2?.candidates?.[0]?.url;
            if (img) images.push(img);
          }
        }

        if (images.length > 0) {
          console.log(`[instagram] got ${images.length} images from @${username} via /posts`);
          return NextResponse.json({ images, source: 'profile' });
        }
      } catch (err: any) {
        console.error('[instagram] /posts error:', err.response?.data || err.message);
      }

      return NextResponse.json({ error: `프로필 @${username} 에서 이미지를 가져오지 못했습니다.` }, { status: 502 });
    }

    // ── Post URL → fetch single post images ───────────────────────────
    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return NextResponse.json({ error: '올바른 인스타그램 주소를 입력해주세요.' }, { status: 400 });
    }

    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      try {
        const response = await axios.post(
          `https://${RAPIDAPI_HOST}/api/instagram/mediaByShortcode`,
          { shortcode },
          { headers: headers(apiKey), timeout: 12000 }
        );

        const images = parseImages(response.data);
        if (images.length > 0) {
          console.log(`[instagram] got ${images.length} images from post`);
          return NextResponse.json({ images });
        }
      } catch (err: any) {
        console.error('[instagram] mediaByShortcode error:', err.response?.data || err.message);
      }
    }

    // Fallback
    const fallbackImages = [
      `https://www.instagram.com/p/${shortcode}/media/?size=l`,
    ];
    return NextResponse.json({ images: fallbackImages, warning: 'Using fallback extraction.' });

  } catch (error: any) {
    console.error('Instagram Extraction Error:', error.message);
    return NextResponse.json({ error: '이미지를 추출할 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
