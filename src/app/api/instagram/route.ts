import { NextResponse } from 'next/server';
import axios from 'axios';

const RAPIDAPI_HOST = "instagram120.p.rapidapi.com";

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function normalizeMediaResponse(raw: unknown): {
  items: Array<{
    type: "image" | "video";
    url: string;
    thumbnail: string;
    width?: number;
    height?: number;
    quality?: number;
    extension: string;
  }>;
  meta: any;
} {
  const items: any[] = [];
  let meta = {};

  if (!raw || !Array.isArray(raw)) {
    return { items, meta };
  }

  for (const entry of raw as Array<Record<string, unknown>>) {
    if (entry.meta && typeof entry.meta === "object") {
      meta = entry.meta;
    }

    const thumbnail = (entry.pictureUrl as string) ?? "";
    const urls = Array.isArray(entry.urls) ? (entry.urls as Array<Record<string, unknown>>) : [];

    if (urls.length === 0) {
      if (thumbnail) {
        items.push({ type: "image", url: thumbnail, thumbnail, extension: "jpg" });
      }
      continue;
    }

    // Pick best quality URL
    const sorted = [...urls].sort((a, b) => ((b.quality as number) ?? 0) - ((a.quality as number) ?? 0));
    const best = sorted[0];
    const ext = (best.extension as string) ?? "jpg";
    const isVideo = ext === "mp4" || (best.name as string | undefined)?.toLowerCase().includes("mp4");

    items.push({
      type: isVideo ? "video" : "image",
      url: best.url as string,
      thumbnail,
      quality: best.quality as number | undefined,
      extension: ext,
    });
  }

  return { items, meta };
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 });
    }

    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return NextResponse.json({ error: '올바른 인스타그램 게시물 주소가 아닙니다. 주소를 다시 한번 확인해 주세요! (예: https://www.instagram.com/p/...)' }, { status: 400 });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      console.warn('RAPIDAPI_KEY not found. Using fallback placeholder image.');
      return NextResponse.json({ 
        images: ['https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop'],
        warning: 'Using fallback because RAPIDAPI_KEY is not configured.'
      });
    }

    // Fetch from RapidAPI
    const response = await axios.post(
      `https://${RAPIDAPI_HOST}/api/instagram/mediaByShortcode`,
      { shortcode },
      {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": RAPIDAPI_HOST,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const normalized = normalizeMediaResponse(response.data);
    
    // Extract only images for the frontend (to generate card news or download)
    const images = normalized.items
      .filter(item => item.type === 'image')
      .map(item => item.url);

    if (images.length === 0) {
      // Fallback to thumbnail if no images found but video is present
      const thumbnails = normalized.items.map(item => item.thumbnail).filter(Boolean);
      if (thumbnails.length > 0) {
        return NextResponse.json({ images: thumbnails });
      }
      return NextResponse.json({ error: 'No images found in this post' }, { status: 404 });
    }

    return NextResponse.json({ images, meta: normalized.meta });

  } catch (error: any) {
    console.error('Error in Instagram API route:', error?.response?.data || error.message);
    
    // Fallback if RapidAPI fails
    return NextResponse.json({ 
      images: ['https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop'],
      warning: 'Using fallback image due to API failure.'
    });
  }
}
