import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.instagram.com/',
      }
    });

    const contentType = response.headers['content-type']?.toString() || 'image/jpeg';
    
    // Ensure we only process images to prevent AI analysis errors (400 Invalid MIME type)
    if (!contentType.includes('image')) {
      console.error('Invalid content type received:', contentType);
      return NextResponse.json({ error: '가져온 데이터가 이미지가 아닙니다. 다른 링크를 시도해주세요.' }, { status: 400 });
    }

    const base64 = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch (error: any) {
    console.error('Base64 Proxy error:', error.message);
    return NextResponse.json({ error: 'Failed to convert image to base64' }, { status: 500 });
  }
}
