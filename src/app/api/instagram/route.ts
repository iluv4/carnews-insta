import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 });
    }

    // Attempt to fetch the Instagram page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract the og:image meta tag
    let imageUrl = $('meta[property="og:image"]').attr('content');

    if (!imageUrl) {
      // Instagram might block the request and return a login page without og:image.
      // In a real production app, you would use a dedicated scraping API (like RapidAPI).
      // For this demonstration, we'll return a placeholder if scraping fails.
      console.warn('Failed to extract og:image. Instagram may be blocking the request.');
      imageUrl = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop';
    }

    return NextResponse.json({ imageUrl });

  } catch (error: any) {
    console.error('Error in Instagram API route:', error.message);
    // Fallback image if totally blocked
    return NextResponse.json({ 
      imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop',
      warning: 'Using fallback image due to Instagram blocking.'
    });
  }
}
