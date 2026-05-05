import { NextResponse } from 'next/server';
import axios from 'axios';

const RAPIDAPI_HOST = "instagram120.p.rapidapi.com";

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 });
    }

    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return NextResponse.json({ error: '올바른 인스타그램 주소를 입력해주세요.' }, { status: 400 });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    
    // 1. Strictly prioritize RapidAPI for reliability
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      try {
        const response = await axios.post(
          `https://${RAPIDAPI_HOST}/api/instagram/mediaByShortcode`,
          { shortcode },
          {
            headers: {
              "x-rapidapi-key": apiKey,
              "x-rapidapi-host": RAPIDAPI_HOST,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );
        
        // RapidAPI response can be an array or a single object depending on the specific endpoint version
        const data = response.data;
        let images: string[] = [];

        if (Array.isArray(data)) {
          images = data.map(item => item.urls?.[0]?.url || item.pictureUrl).filter(Boolean);
        } else if (data && typeof data === 'object') {
          // Some versions return a nested object
          const media = data.items || [data];
          images = media.map((item: any) => item.url || item.pictureUrl || item.urls?.[0]?.url).filter(Boolean);
        }

        if (images.length > 0) {
          return NextResponse.json({ images });
        }
      } catch (err: any) {
        console.error('RapidAPI detailed failure:', err.response?.data || err.message);
      }
    }

    // 2. Fallback only if RapidAPI is unavailable or fails
    const fallbackImages = [`https://www.instagram.com/p/${shortcode}/media/?size=l`];
    return NextResponse.json({ images: fallbackImages, warning: 'RapidAPI failed, using public fallback.' });

  } catch (error: any) {
    console.error('Instagram Extraction Error:', error.message);
    return NextResponse.json({ error: '이미지를 추출할 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
