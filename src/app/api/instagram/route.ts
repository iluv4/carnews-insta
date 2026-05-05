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
            timeout: 12000,
          }
        );
        
        const data = response.data;
        let images: string[] = [];

        // Comprehensive response parsing for various API versions
        if (Array.isArray(data)) {
          images = data.map(item => item.url || item.pictureUrl || item.urls?.[0]?.url).filter(Boolean);
        } else if (data && typeof data === 'object') {
          const items = data.items || data.data?.items || [data];
          images = items.map((item: any) => 
            item.url || 
            item.pictureUrl || 
            item.urls?.[0]?.url || 
            item.image_versions2?.candidates?.[0]?.url
          ).filter(Boolean);
        }

        if (images.length > 0) {
          console.log(`Successfully extracted ${images.length} images via RapidAPI`);
          return NextResponse.json({ images });
        }
      } catch (err: any) {
        console.error('RapidAPI Error Detail:', err.response?.data || err.message);
      }
    }

    // 2. Fallback to public sources if RapidAPI fails
    const fallbackImages = [
      `https://www.instagram.com/p/${shortcode}/media/?size=l`,
      `https://images.weserv.nl/?url=instagram.com/p/${shortcode}/media/?size=l`
    ];
    return NextResponse.json({ images: fallbackImages, warning: 'Using fallback extraction.' });

  } catch (error: any) {
    console.error('Instagram Extraction Error:', error.message);
    return NextResponse.json({ error: '이미지를 추출할 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
