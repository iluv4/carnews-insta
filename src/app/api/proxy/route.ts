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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/'
      }
    });

    // Ensure content-type is a string to satisfy TypeScript/NextResponse
    const contentType = response.headers['content-type']?.toString() || 'image/jpeg';
    
    return new NextResponse(response.data, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
